// Founder-email sweeps. Together they replace the old instant founder-welcome
// with a short delay between the auth welcome ("Welcome to Coldpilot") and the
// personal note from Yemi, so the founder mail lands a few minutes later
// instead of competing with the system welcome for the same attention spike.
//
//   founderWelcomeSentAt  -> set once the founder welcome has gone out
//
//   founder-welcome fires ~5-10 minutes after emailVerified.
//   founder-billing-followup fires post-trial (see billing-followup.ts).

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email/send";

// Let a predictable gap elapse after verification so the auth welcome lands
// first; then the founder note is its own second touch, not a second pixel
// of the same burst. 5 minutes of slack keeps it prompt yet fast enough to
// feel like a follow-up rather than a delayed campaign.
export const FOUNDER_WELCOME_MIN_MS = 5 * 60 * 1000;
export const FOUNDER_WELCOME_MAX_MS = 24 * 60 * 60 * 1000;

export async function sweepFounderWelcome(): Promise<{ sent: number }> {
  const now = Date.now();
  // Only users verified within the sendable window are eligible — a legacy
  // account that verified months ago must never suddenly get the founder mail,
  // and there's no point dragging the whole user table through the sweep.
  const windowStart = new Date(now - FOUNDER_WELCOME_MAX_MS);
  const windowEnd = new Date(now - FOUNDER_WELCOME_MIN_MS);
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      founderWelcomeSentAt: null,
      emailVerified: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, name: true, email: true, emailVerified: true },
  });

  let sent = 0;

  for (const user of users) {
    if (!user.emailVerified || !user.email) continue;
    const ageMs = now - user.emailVerified.getTime();
    if (ageMs < FOUNDER_WELCOME_MIN_MS || ageMs > FOUNDER_WELCOME_MAX_MS) continue;

    try {
      const firstName = user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0];
      await sendTransactionalEmail({
        to: user.email,
        template: "founder-welcome",
        data: { name: firstName },
        fromFounder: true,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { founderWelcomeSentAt: new Date() },
      });
      sent += 1;
    } catch (err) {
      console.error("[founder-welcome] sweep error for user", user.id, err);
    }
  }

  return { sent };
}