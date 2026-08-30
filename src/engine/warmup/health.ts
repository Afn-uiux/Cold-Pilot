import { prisma } from "@/lib/prisma";
import { sendEmailSafe } from "@/lib/email/send";

export type WarmupHealthState = "healthy" | "watch" | "throttled";

export interface HealthAdjustment {
  volumeMultiplier: number;
  minWaitMultiplier: number;
}

// Health state thresholds align with the industry model (Instantly):
//   - healthy   >= 85%  inbox placement  — ready / good
//   - watch     60-84%  — reduce volume, monitor
//   - throttled  < 60%  — broken (DNS/ramp/reputation), needs fixing
export const HEALTHY_MIN = 85;
export const THROTTLED_MAX = 60;

// Bounce signal thresholds (kept SEPARATE from the warmup placement score,
// exactly like Instantly/Smartlead). A hard-bounce rate at or above ~1.8%
// (the per-inbox Bounce Protection ceiling) flags a mailbox as degraded so it
// stops being a peer receiver and recovers via seeds only.
export const BOUNCE_FLAG_RATE = 1.8;
export const BOUNCE_HEALTHY_RATE = 1.0;

const WINDOW_DAYS = 7;

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

export interface MailboxHealth {
  healthScore: number;
  healthState: WarmupHealthState;
  spamRate: number;
  inboxPlacementRate: number;
  sentInWindow: number;
  inboxPlaced: number;
  spamCount: number;
  // Separate bounce signal — does NOT feed the placement score.
  hardBounceRate: number;
  softBounceRate: number;
  bounced: boolean; // hard-bounce rate >= BOUNCE_FLAG_RATE
}

// Warmup Health Score = (warmup emails in inbox ÷ total warmup sent) × 100,
// over a rolling 7-day window (Instantly's documented model). Placement only:
// "does not measure campaign placement" and does not factor bounces.
// Spam placements count as NOT inbox-placed; rescued-from-spam counts as
// inbox-placed (rescue is the reputation-builder). If no warmup was sent in
// the last 7 days the score resets to 0 (Instantly's documented behavior).
export async function calculateHealthScore(mailboxId: string): Promise<MailboxHealth> {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Only consider warmup sends in the rolling window.
  const baseWhere = {
    senderMailboxId: mailboxId,
    sentAt: { gte: windowStart },
    status: { not: "failed" },
  };

  const totalSent = await prisma.warmupLog.count({ where: baseWhere });

  if (totalSent === 0) {
    // No warmup traffic in the window — score is 0 (nothing measured yet),
    // neither healthy nor broken. Distinct from a measured low placement.
    return {
      healthScore: 0,
      healthState: "watch",
      spamRate: 0,
      inboxPlacementRate: 0,
      sentInWindow: 0,
      inboxPlaced: 0,
      spamCount: 0,
      hardBounceRate: 0,
      softBounceRate: 0,
      bounced: false,
    };
  }

  // Spam-flagged logs = landed in spam AND not rescued. Rescued spam counts
  // as inbox-placed (healing), so exclude rescued logs from the spam bucket.
  const spamCount = await prisma.warmupLog.count({
    where: { ...baseWhere, foundInSpam: true, rescuedFromSpam: false },
  });

  const inboxPlaced = totalSent - spamCount;
  const inboxPlacementRate = Math.round((inboxPlaced / totalSent) * 100);

  let score = inboxPlacementRate;

  let healthState: WarmupHealthState = "healthy";
  if (score < THROTTLED_MAX) healthState = "throttled";
  else if (score < HEALTHY_MIN) healthState = "watch";

  // Separately compute the bounce signal over the same rolling window. Bounced
  // warmup logs are marked status="failed" (with a bounceType), so this query
  // intentionally does NOT filter out failed status — it counts them.
  const bounceWhere = {
    senderMailboxId: mailboxId,
    sentAt: { gte: windowStart },
    bounceType: { not: null },
  };
  const bounceCounts = await prisma.warmupLog.groupBy({
    by: ["bounceType"],
    where: bounceWhere,
    _count: { _all: true },
  });
  let hard = 0;
  let soft = 0;
  for (const b of bounceCounts) {
    if (b.bounceType === "hard_bounce") hard = b._count._all;
    else if (b.bounceType === "soft_bounce") soft = b._count._all;
  }
  // Denominator = every warmup attempt that actually went out in the window
  // (successes + all failed/bounced), so the bounce rate is honest.
  const totalAttempts = totalSent + bounceCounts.reduce((n, b) => n + b._count._all, 0);
  const hardBounceRate = totalAttempts > 0 ? (hard / totalAttempts) * 100 : 0;
  const softBounceRate = totalAttempts > 0 ? (soft / totalAttempts) * 100 : 0;
  const bounced = hardBounceRate >= BOUNCE_FLAG_RATE;

  return {
    healthScore: score,
    healthState,
    spamRate: (spamCount / totalSent) * 100,
    inboxPlacementRate,
    sentInWindow: totalSent,
    inboxPlaced,
    spamCount,
    hardBounceRate,
    softBounceRate,
    bounced,
  };
}

export async function saveHealthLog(mailboxId: string): Promise<void> {
  const mailbox = await prisma.emailAccount.findUnique({
    where: { id: mailboxId },
    select: { id: true, warmupStartedAt: true, warmupWeek: true, currentDailyVolume: true },
  });
  if (!mailbox) return;

  const health = await calculateHealthScore(mailboxId);

  // Send warmup health warning if state degraded
  const fullMailbox = await prisma.emailAccount.findUnique({
    where: { id: mailboxId },
    select: { userId: true, email: true, healthState: true },
  });
  const degraded = health.healthState !== "healthy";
  if (fullMailbox && degraded && fullMailbox.healthState === "healthy") {
    const user = await prisma.user.findUnique({ where: { id: fullMailbox.userId }, select: { email: true } });
    if (user?.email) sendEmailSafe(user.email, "warmup-health-dropped");
  }

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
      healthScore: health.healthScore,
      healthState: health.healthState,
      warmupBounceRate: health.hardBounceRate,
      warmupBounceFlag: health.bounced,
      warmupWeek,
      currentDailyVolume,
      lastHealthCheckAt: new Date(),
    },
  });
}
