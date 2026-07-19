import { prisma } from "@/lib/prisma";

export type WarmupHealthState = "healthy" | "watch" | "throttled";

export interface HealthAdjustment {
  volumeMultiplier: number;
  minWaitMultiplier: number;
}

export function adjustmentFor(state: WarmupHealthState): HealthAdjustment {
  switch (state) {
    case "throttled":
      return { volumeMultiplier: 0.25, minWaitMultiplier: 3.0 };
    case "watch":
      return { volumeMultiplier: 0.7, minWaitMultiplier: 1.5 };
    default:
      return { volumeMultiplier: 1.0, minWaitMultiplier: 1.0 };
  }
}

export async function calculateHealthScore(mailboxId: string): Promise<{
  healthScore: number;
  healthState: WarmupHealthState;
  spamRate: number;
}> {
  const mailbox = await prisma.emailAccount.findUnique({
    where: { id: mailboxId },
  });
  if (!mailbox) throw new Error("Mailbox not found");

  const totalSent = await prisma.warmupLog.count({
    where: { senderMailboxId: mailboxId, status: { not: "failed" } },
  });

  if (totalSent === 0) {
    return { healthScore: 100, healthState: "healthy", spamRate: 0 };
  }

  const spamCount = await prisma.warmupLog.count({
    where: { senderMailboxId: mailboxId, foundInSpam: true },
  });
  const rescuedCount = await prisma.warmupLog.count({
    where: { senderMailboxId: mailboxId, rescuedFromSpam: true },
  });

  const spamRate = (spamCount / totalSent) * 100;

  let score = 100;
  if (spamRate > 10) score -= 35;

  // Volume ramp consistency check
  if ((mailbox.warmupWeek || 1) > 2) {
    const expected = Math.min(
      mailbox.targetDailyVolume || 50,
      5 + ((mailbox.warmupWeek || 1) - 1) * 5,
    );
    if ((mailbox.currentDailyVolume || 5) < expected * 0.7) {
      score -= 10;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let healthState: WarmupHealthState = "healthy";
  if (score < 50) healthState = "throttled";
  else if (score < 80) healthState = "watch";

  return { healthScore: score, healthState, spamRate };
}

export async function saveHealthLog(mailboxId: string): Promise<void> {
  const mailbox = await prisma.emailAccount.findUnique({
    where: { id: mailboxId },
    select: { id: true, warmupStartedAt: true, warmupWeek: true, currentDailyVolume: true },
  });
  if (!mailbox) return;

  const { healthScore, healthState } = await calculateHealthScore(mailboxId);

  // Increment warmupWeek based on days since warmupStartedAt
  let warmupWeek = mailbox.warmupWeek || 1;
  let currentDailyVolume = mailbox.currentDailyVolume || 5;

  if (mailbox.warmupStartedAt) {
    const daysSinceStart = Math.floor(
      (Date.now() - new Date(mailbox.warmupStartedAt).getTime()) / (24 * 60 * 60 * 1000),
    );
    const newWeek = Math.floor(daysSinceStart / 7) + 1;
    if (newWeek > warmupWeek) {
      warmupWeek = newWeek;
    }
  }

  // Update currentDailyVolume based on today's sent count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySent = await prisma.warmupLog.count({
    where: {
      senderMailboxId: mailboxId,
      sentAt: { gte: todayStart },
      status: { not: "failed" },
    },
  });
  if (todaySent > 0) {
    currentDailyVolume = todaySent;
  }

  await prisma.emailAccount.update({
    where: { id: mailboxId },
    data: {
      healthScore,
      healthState,
      warmupWeek,
      currentDailyVolume,
      lastHealthCheckAt: new Date(),
    },
  });
}
