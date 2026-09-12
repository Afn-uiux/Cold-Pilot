// Founder trial check-ins. The scheduler's sweepTrialCheckups() watches the
// free-trial clock of verified, never-paid users and fires each founder mail
// exactly once (stamped on the user row, so re-runs every 2 minutes can't
// double-send):
//   - founderTrialExpiringSentAt  -> "Hey {{name}}, your trial's wrapping up"
//                                    within the last ~3 days of the trial
//   - founderTrialExpiredSentAt   -> "Hey {{name}}, your trial ended"
//                                    shortly after the clock passes
// Trial-voided accounts (abuse) and anyone who ever paid are skipped: the
// momentum pitch is for genuinely-trialing free users, not sanctions or
// customers.

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email/send";

const DAY_MS = 24 * 60 * 60 * 1000;
// Fires the expiring mail inside the last 3 days of the trial.
export const TRIAL_REMINDER_DAYS = 3;
// Only email users whose trial ended within the last week — a trial that ran
// out a month ago is ancient history, and that momentum angle would ring false.
export const TRIAL_EXPIRED_LOOKBACK_MS = 7 * DAY_MS;

export async function sweepTrialCheckups(): Promise<{ expiring: number; expired: number }> {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: {
      plan: "free",
      deletedAt: null,
      emailVerified: { not: null },
      trialVoided: false,
      trialEndsAt: { not: null, gte: new Date(now - TRIAL_EXPIRED_LOOKBACK_MS) },
      paymentEvents: { none: {} },
    },
    select: {
      id: true,
      name: true,
      email: true,
      trialEndsAt: true,
      founderTrialExpiringSentAt: true,
      founderTrialExpiredSentAt: true,
    },
  });

  let expiring = 0;
  let expired = 0;

  for (const user of users) {
    if (!user.email || !user.trialEndsAt) continue;
    const msLeft = user.trialEndsAt.getTime() - now;

    try {
      // Trial still running but inside the reminder window.
      if (msLeft > 0 && msLeft <= TRIAL_REMINDER_DAYS * DAY_MS && !user.founderTrialExpiringSentAt) {
        await sendTransactionalEmail({
          to: user.email,
          template: "founder-trial-expiring",
          data: { name: user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0] },
          fromFounder: true,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { founderTrialExpiringSentAt: new Date() },
        });
        expiring += 1;
        continue;
      }

      // Clock passed: momentum mail. Never mailed before, and the send is
      // awaited so a failure doesn't burn the once-per-user stamp.
      if (msLeft <= 0 && !user.founderTrialExpiredSentAt) {
        await sendTransactionalEmail({
          to: user.email,
          template: "founder-trial-expired",
          data: { name: user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0] },
          fromFounder: true,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { founderTrialExpiredSentAt: new Date() },
        });
        expired += 1;
      }
    } catch (err) {
      console.error("[trial-checkups] sweep error for user", user.id, err);
    }
  }

  return { expiring, expired };
}