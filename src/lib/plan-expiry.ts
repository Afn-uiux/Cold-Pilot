// One-time plan purchases last PLAN_DAYS, then expire back to the free tier.
// While Bachs has subscriptions disabled account-wide, plans are sold as a
// single charge (no recurring billing); the user must manually re-buy to keep
// the plan. The scheduler calls sweepPlanExpiries() on its tick:
//   - 3 days before expiry  -> plan-expiring-3 reminder
//   - 1 day before expiry   -> plan-expiring-1 reminder
//   - at expiry             -> downgrade to "free" + plan-ended email
// planReminderSentDays is a bitmask (bit0 = 3-day sent, bit1 = 1-day sent) so
// reminders fire exactly once even though the sweep runs every 2 minutes.

import { prisma } from "@/lib/prisma";
import { sendEmailSafe } from "@/lib/email/send";

export const PLAN_DAYS = 30;
export const PLAN_MS = PLAN_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_3D = 1 << 0;
const REMINDER_1D = 1 << 1;

export async function sweepPlanExpiries(): Promise<{
  downgraded: number;
  reminded3d: number;
  reminded1d: number;
}> {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: { plan: { not: "free" }, planExpiresAt: { not: null } },
    select: {
      id: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      planReminderSentDays: true,
    },
  });

  let downgraded = 0;
  let reminded3d = 0;
  let reminded1d = 0;

  for (const user of users) {
    if (!user.planExpiresAt) continue;
    const msLeft = user.planExpiresAt.getTime() - now;

    try {
      if (msLeft <= 0) {
        // Expired: drop back to free and clear the clock. The account keeps
        // its data/credits; only plan-gated extras are revoked.
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { plan: "free", planExpiresAt: null, planReminderSentDays: 0 },
          }),
          prisma.paymentEvent.create({
            data: {
              userId: user.id,
              type: "plan_downgraded",
              amount: null,
              currency: "NGN",
              plan: user.plan,
              subscriptionId: null,
              providerEventId: `plan-expiry-${user.id}-${user.planExpiresAt.getTime()}`,
            },
          }),
        ]);
        if (user.email) {
          sendEmailSafe(user.email, "plan-ended", {
            plan_name: user.plan,
          });
        }
        downgraded += 1;
        continue;
      }

      const daysLeft = Math.ceil(msLeft / DAY_MS);
      let flags = user.planReminderSentDays ?? 0;

      if (daysLeft <= 3 && (flags & REMINDER_3D) === 0) {
        if (user.email) sendEmailSafe(user.email, "plan-expiring-3", { plan_name: user.plan });
        flags |= REMINDER_3D;
        reminded3d += 1;
      }
      if (daysLeft <= 1 && (flags & REMINDER_1D) === 0) {
        if (user.email) sendEmailSafe(user.email, "plan-expiring-1", { plan_name: user.plan });
        flags |= REMINDER_1D;
        reminded1d += 1;
      }

      if (flags !== user.planReminderSentDays) {
        await prisma.user.update({
          where: { id: user.id },
          data: { planReminderSentDays: flags },
        });
      }
    } catch (err) {
      console.error("[plan-expiry] sweep error for user", user.id, err);
    }
  }

  return { downgraded, reminded3d, reminded1d };
}