export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBachsSignature } from "@/lib/bachs";
import { addCredits } from "@/lib/credits";
import { CREDIT_PACKS, PLANS, type PlanId } from "@/lib/plans";
import { Prisma } from "@prisma/client";
import { USD_NAIRA_RATE } from "@/lib/currency";
import { isBillingEnabled } from "@/lib/billing-gate";

// Maps a Bachs subscription status to whether the user should keep plan access.
// `trialing` and `active` grant access; anything else (past_due, unpaid,
// canceled, paused) does not.
function statusGrantsAccess(status: string | undefined): boolean {
  return status === "active" || status === "trialing";
}

interface SubscriptionCustomer {
  customer_id?: string;
  email?: string;
}

// Resolves the ColdPilot user a subscription event belongs to. Prefer the
// userId we stamped on the checkout metadata; fall back to the customer's
// email so fulfillment still works if Bachs doesn't propagate checkout
// metadata onto the subscription event.
async function resolveSubscriptionUser(
  userIdHint: string | undefined,
  customer: SubscriptionCustomer | undefined
): Promise<string | null> {
  if (userIdHint) return userIdHint;
  if (customer?.email) {
    const user = await prisma.user.findUnique({
      where: { email: customer.email },
      select: { id: true },
    });
    if (user) return user.id;
  }
  return null;
}

interface SubscriptionData {
  subscription_id?: string;
  product_id?: string;
  status?: string;
  customer?: SubscriptionCustomer;
  metadata?: Record<string, unknown>;
}

interface CollectionData {
  amount?: string;
  metadata?: Record<string, unknown>;
}

interface BachsEvent {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
}

// Resolves the plan a subscription represents. Prefer the explicit plan we
// stamped on checkout metadata; fall back to mapping the product id so events
// without metadata still reconcile correctly.
function resolvePlanId(
  metadata: Record<string, unknown> | undefined,
  productId: string | undefined
): PlanId | null {
  const fromMeta = typeof metadata?.plan === "string" ? (metadata.plan as string) : undefined;
  if (fromMeta && PLANS[fromMeta as PlanId] && PLANS[fromMeta as PlanId].price > 0) {
    return fromMeta as PlanId;
  }
  if (productId) {
    for (const planId of ["starter", "pro", "agency"] as PlanId[]) {
      const suffix = planId.toUpperCase();
      if (
        process.env[`BACHS_PRODUCT_${suffix}_NGN`] === productId ||
        process.env[`BACHS_PRODUCT_${suffix}_USD`] === productId
      ) {
        return planId;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Billing is dormant until BILLING_ENABLED is set. When disabled we return
  // 200 without doing anything (and without firing any provider retries), so an
  // event can never be fulfilled while the integration is in sandbox.
  if (!isBillingEnabled()) {
    return NextResponse.json({ disabled: true });
  }

  // Always read the raw body BEFORE parsing so signature verification sees the
  // exact bytes Bachs signed.
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-bachs-signature");
  const timestamp = req.headers.get("x-bachs-timestamp");

  if (!verifyBachsSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: BachsEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = event?.id;
  const type = event?.type;
  if (!eventId || !type) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  // Idempotency: Bachs delivers at-least-once; record processed event ids so a
  // re-delivery does not double-fulfill. The unique primary key makes concurrent
  // duplicates safe (one create wins, the other hits P2002 and is treated as a
  // no-op success).
  try {
    await prisma.bachsWebhookEvent.create({ data: { id: eventId, type } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  const data = event.data || {};

  try {
    if (type === "collection.succeeded") {
      await handleCollectionSucceeded(eventId, data as CollectionData);
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated"
    ) {
      await handleSubscriptionState(eventId, type, data as SubscriptionData);
    } else if (type === "customer.subscription.deleted") {
      await handleSubscriptionCanceled(eventId, data as SubscriptionData);
    }
    // Other events (invoice.*, checkout.completed, etc.) are intentionally
    // ignored; fulfillment keys off the events above.
  } catch (err) {
    console.error("[bachs-webhook] fulfillment failed", type, err);
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Payment history ledger (the "water meter"). Every handled billing event
// writes one row so the platform remembers who paid what and when. This must
// NEVER break fulfillment: a replay hits the unique providerEventId (P2002,
// ignored) and any other ledger failure is logged while money movement
// continues. Current state stays on User; the story lives here.
async function recordPaymentEvent(data: {
  userId: string;
  type: string;
  amount?: number | null;
  currency?: string;
  plan?: string | null;
  subscriptionId?: string | null;
  providerEventId: string;
}): Promise<void> {
  try {
    await prisma.paymentEvent.create({
      data: {
        userId: data.userId,
        type: data.type,
        amount: data.amount ?? null,
        currency: data.currency ?? "NGN",
        plan: data.plan ?? null,
        subscriptionId: data.subscriptionId ?? null,
        providerEventId: data.providerEventId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    console.error("[bachs-webhook] payment ledger write failed", data.providerEventId, err);
  }
}

async function handleCollectionSucceeded(
  eventId: string,
  data: CollectionData
): Promise<void> {
  const metadata = data.metadata || {};
  if (metadata.kind !== "credits") return;

  const userId = String(metadata.userId || "");
  const credits = Number(metadata.credits);
  if (!userId || !Number.isFinite(credits) || credits <= 0) return;

  const pack = CREDIT_PACKS.find((p) => p.credits === credits);
  if (!pack) return;

  // Defence in depth: the webhook is signed, but confirm the charged amount
  // matches the credit pack price before crediting. metadata.currency tells us
  // which product (NGN vs USD) was purchased; pack.price is always expressed in
  // Naira major units, so we convert for USD charges.
  const paid = Number(data?.amount);
  const currency = metadata.currency === "USD" ? "USD" : "NGN";
  const expected =
    currency === "USD"
      ? Math.round((pack.price / USD_NAIRA_RATE) * 100) / 100
      : pack.price;
  if (!Number.isFinite(paid) || Math.abs(paid - expected) > 0.001) {
    console.warn(
      `[bachs-webhook] amount mismatch for credit pack ${credits} (${currency}): paid=${paid} expected=${expected}`,
      { eventId, userId }
    );
    return;
  }

  // refId=eventId makes the ledger robust to a replayed webhook even if the
  // dedup row were somehow lost.
  await addCredits(userId, credits, "purchase", eventId);

  await recordPaymentEvent({
    userId,
    type: "payment_succeeded",
    amount: paid,
    currency,
    subscriptionId: null,
    providerEventId: eventId,
  });
}

async function handleSubscriptionState(eventId: string, eventType: string, data: SubscriptionData): Promise<void> {
  const metadata = data.metadata || {};
  const userId = await resolveSubscriptionUser(
    metadata?.userId ? String(metadata.userId) : undefined,
    data?.customer
  );
  const subscriptionId = data?.subscription_id;
  if (!userId || !subscriptionId) return;

  const planId = resolvePlanId(metadata, data?.product_id);
  if (!planId) return;

  const customerId = data?.customer?.customer_id;

  const grantsAccess = statusGrantsAccess(data?.status);
  let plan: string;
  if (grantsAccess) {
    plan = planId;
  } else {
    // past_due / unpaid / paused: keep the account usable but drop paid-plan
    // limits back to the free tier until the subscription recovers.
    plan = "free";
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      bachsSubscriptionId: subscriptionId,
      ...(customerId ? { bachsCustomerId: customerId } : {}),
    },
  });

  await recordPaymentEvent({
    userId,
    type:
      eventType === "customer.subscription.created"
        ? "subscription_started"
        : grantsAccess
          ? "subscription_renewed"
          : "subscription_past_due",
    amount: null,
    currency: "NGN",
    plan: planId,
    subscriptionId,
    providerEventId: eventId,
  });
}

async function handleSubscriptionCanceled(eventId: string, data: SubscriptionData): Promise<void> {
  const metadata = data.metadata || {};
  const userId = await resolveSubscriptionUser(
    metadata?.userId ? String(metadata.userId) : undefined,
    data?.customer
  );
  const subscriptionId = data?.subscription_id;
  if (!userId || !subscriptionId) return;

  // Only downgrade if this is the user's active subscription, so a stale
  // "deleted" event for an old subscription doesn't revoke a newer one.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bachsSubscriptionId: true },
  });
  if (user && user.bachsSubscriptionId === subscriptionId) {
    await prisma.user.update({
      where: { id: userId },
      data: { plan: "free", bachsSubscriptionId: null },
    });
  }

  await recordPaymentEvent({
    userId,
    type: "subscription_canceled",
    amount: null,
    currency: "NGN",
    plan: null,
    subscriptionId,
    providerEventId: eventId,
  });
}
