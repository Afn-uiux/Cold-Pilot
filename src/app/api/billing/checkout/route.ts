export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createCheckoutSession } from "@/lib/bachs";
import { CREDIT_PACKS, PLANS, type PlanId } from "@/lib/plans";
import { trialGuard } from "@/lib/trial";
import { currencyFromHeaders, type Currency } from "@/lib/currency";

const PUBLIC_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await trialGuard(session.user.id);
  if (blocked) return blocked;

  let body: { kind?: string; credits?: number; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, bachsCustomerId: true, billingCurrency: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolve the checkout currency: an explicit USD preference wins; otherwise
  // auto-detect from the visitor's country (NG -> NGN, everywhere else -> USD).
  const detected: Currency = currencyFromHeaders(await headers());
  const billingCurrency: Currency = user.billingCurrency === "USD" ? "USD" : detected;

  const successUrl = `${PUBLIC_URL}/dashboard/settings?tab=Billing&billing=success`;
  const cancelUrl = `${PUBLIC_URL}/dashboard/settings?tab=Billing&billing=cancelled`;

  try {
    if (body.kind === "credits") {
      const credits = Number(body.credits);
      const pack = CREDIT_PACKS.find((p) => p.credits === credits);
      if (!pack) return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });

      const productId = process.env[`BACHS_CREDIT_${pack.credits}_${billingCurrency}`];
      if (!productId) {
        return NextResponse.json({
          error: `Credit packs in ${billingCurrency} aren't configured yet.`,
        }, { status: 501 });
      }

      const checkout = await createCheckoutSession({
        customerEmail: user.email,
        customerName: user.name,
        successUrl,
        cancelUrl,
        productCart: [{ product_id: productId }],
        metadata: { userId: session.user.id, kind: "credits", credits: String(pack.credits), currency: billingCurrency },
      });

      return NextResponse.json({ checkoutUrl: checkout.checkout_url });
    }

    if (body.kind === "plan") {
      const planId = body.plan as PlanId;
      const plan = PLANS[planId];
      if (!plan || plan.price === 0) {
        return NextResponse.json({ error: "Unknown or free plan" }, { status: 400 });
      }

      const productKey = `BACHS_PRODUCT_${planId.toUpperCase()}_${billingCurrency}`;
      const productId = process.env[productKey];
      if (!productId) {
        return NextResponse.json({
          error: `Payments for the ${plan.name} plan aren't configured yet (missing ${productKey}).`,
        }, { status: 501 });
      }

      const checkout = await createCheckoutSession({
        customerEmail: user.email,
        customerName: user.name,
        successUrl,
        cancelUrl,
        productCart: [{ product_id: productId }],
        metadata: { userId: session.user.id, kind: "plan", plan: planId, currency: billingCurrency },
      });

      return NextResponse.json({ checkoutUrl: checkout.checkout_url });
    }

    return NextResponse.json({ error: "Unknown checkout kind" }, { status: 400 });
  } catch (err) {
    console.error("[billing] checkout failed", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
