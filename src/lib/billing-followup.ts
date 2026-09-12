// Billing-exploration follow-up. When BILLING_ENABLED is live, the Billing tab
// records lastBillingVisitAt (see /api/billing/visit, fired by BillingSection
// on mount). This sweep finds free users who explored billing but never
// subscribed, waits out a cooldown so someone who just peeked doesn't get a
// mail, then sends exactly one founder follow-up (billingFollowUpSentAt makes
// it once-per-user, ever). Billing is gated like everything else: while the
// feature is dormant the sweep does nothing.
//
// Users are only eligible AFTER their trial has ended — asking someone to
// subscribe while they're still actively trialing (or a legacy free account
// with no trial clock) is off. So the sweep targets users whose trial either
// ended or never ran; an in-trial user who pokes at billing is simply not
// contacted yet.

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email/send";
import { isBillingEnabled } from "@/lib/billing-gate";

// Wait this long after the billing visit before emailing, so a casual peek at
// the tab doesn't trigger the follow-up.
export const BILLING_FOLLOWUP_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export async function sweepBillingFollowUps(): Promise<{ sent: number }> {
  if (!isBillingEnabled()) return { sent: 0 };

  const now = Date.now();
  const nowDate = new Date();
  const users = await prisma.user.findMany({
    where: {
      plan: "free",
      deletedAt: null,
      emailVerified: { not: null },
      // Trial must be over (ended or never started) — never during an active trial.
      OR: [
        { trialEndsAt: null },
        { trialEndsAt: { lt: nowDate } },
      ],
      lastBillingVisitAt: { not: null },
      billingFollowUpSentAt: null,
      // Never pay-as-you-go or returning buyers: they DID check out (credit
      // purchases keep plan="free", so plan alone can't tell them apart). A
      // PaymentEvent row means they've handed over money and must not get a
      // "you didn't checkout" nudge.
      paymentEvents: { none: {} },
    },
    select: { id: true, name: true, email: true, lastBillingVisitAt: true },
  });

  let sent = 0;

  for (const user of users) {
    if (!user.email || !user.lastBillingVisitAt) continue;
    if (now - user.lastBillingVisitAt.getTime() < BILLING_FOLLOWUP_COOLDOWN_MS) continue;

    try {
      const firstName = (user.name || user.email.split("@")[0] || "there")
        .trim()
        .split(/\s+/)[0];
      // Await the send so a failed send does NOT burn the once-per-user stamp —
      // the sweep retries next tick instead of silently losing the follow-up.
      await sendTransactionalEmail({ to: user.email, template: "founder-billing-followup", data: { name: firstName }, fromFounder: true });
      await prisma.user.update({
        where: { id: user.id },
        data: { billingFollowUpSentAt: new Date() },
      });
      sent += 1;
    } catch (err) {
      console.error("[billing-followup] sweep error for user", user.id, err);
    }
  }

  return { sent };
}