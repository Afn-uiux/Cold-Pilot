export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/bachs";
import { CREDIT_PACKS, PLANS, type PlanId } from "@/lib/plans";
import { type Currency } from "@/lib/currency";
import { isBillingEnabled } from "@/lib/billing-gate";

// Bachs requires success_url/cancel_url to be publicly reachable, so localhost
// is rejected. In dev, point CHECKOUT_PUBLIC_URL at your ngrok tunnel so the
// hosted checkout can route back to your local dev server. Production can leave
// it unset and fall back to NEXT_PUBLIC_URL.
const PUBLIC_URL = process.env.CHECKOUT_PUBLIC_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  // Billing is dormant until BILLING_ENABLED is set. Keep the feature behind
  // the flag so a sandbox/integration state can never mint a live checkout.
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Payments aren't available yet. Please check back soon." },
      { status: 501 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // No trialGuard here on purpose: checkout is how an expired trial gets
  // resolved (paying restores access), so blocking expired users from the
  // payment route would trap them with no way out. trialGuard only fires on
  // TrialExpiredError — bans are enforced elsewhere and unaffected.

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

  // Checkout currency is fixed to the currency stored on the account at
  // signup — a VPN or later travel cannot change it mid-life. Legacy accounts
  // created before signup detection carry the NGN default, which matches the
  // fallback of the old behavior.
  const billingCurrency: Currency = user.billingCurrency === "USD" ? "USD" : "NGN";

  // When CHECKOUT_PUBLIC_URL differs from NEXT_PUBLIC_URL (dev via a tunnel),
  // route the return through a small redirect endpoint so the browser lands
  // back on the real app origin where the session cookie applies. Otherwise
  // (production) go straight to the settings page.
  const useReturnBounce = !!process.env.CHECKOUT_PUBLIC_URL;
  const successUrl = useReturnBounce
    ? `${PUBLIC_URL}/api/billing/return?to=success`
    : `${PUBLIC_URL}/dashboard/settings?tab=Billing&billing=success`;
  const cancelUrl = useReturnBounce
    ? `${PUBLIC_URL}/api/billing/return?to=cancelled`
    : `${PUBLIC_URL}/dashboard/settings?tab=Billing&billing=cancelled`;

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
