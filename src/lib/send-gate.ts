import { prisma } from "@/lib/prisma";
import { sendEmailSafe } from "./email/send";

const GLOBAL_MIN_WAIT_MS = 60 * 1000; // 60s floor between any sends from same account
const GLOBAL_JITTER_MS = 120 * 1000; // + up to 2min random jitter → 60-180s total gap

// Deterministic jitter for the inter-send gap, derived from the last send's
// timestamp: every retry reports the SAME required wait until a real send
// lands, so a skip-and-retry loop can never squeeze a send in earlier.
function jitterFor(lastSentAt: number): number {
  let h = (lastSentAt ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) % GLOBAL_JITTER_MS;
}

export interface CanSendResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

/**
 * Checks whether an email account is allowed to send right now.
 * Both campaign and warmup systems must call this before sending.
 * Enforces:
 *  1. Account-level daily send cap (shared across campaign + warmup)
 *  2. Minimum gap between any two sends from the same account
 */
export async function canSendFromAccount(
  emailAccountId: string,
  dailySendLimit: number,
): Promise<CanSendResult> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Count campaign sends today
  const campaignSentToday = await prisma.emailLog.count({
    where: {
      emailAccountId,
      sentAt: { gte: todayStart },
    },
  });

  // Count warmup sends today
  const warmupSentToday = await prisma.warmupLog.count({
    where: {
      senderMailboxId: emailAccountId,
      sentAt: { gte: todayStart },
      status: { in: ["sent", "delivered"] },
    },
  });

  const totalSentToday = campaignSentToday + warmupSentToday;

  // Send approaching limit warning at 85%
  if (totalSentToday >= dailySendLimit * 0.85 && totalSentToday < dailySendLimit) {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { userId: true },
    });
    if (account) {
      const user = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
      if (user?.email) sendEmailSafe(user.email, "approaching-limit");
    }
  }

  if (totalSentToday >= dailySendLimit) {
    return {
      allowed: false,
      reason: `You've hit today's send limit (${totalSentToday}/${dailySendLimit}) — it resets at midnight. Nice pacing!`,
    };
  }

  // Check time since last send from this account (campaign or warmup)
  const lastCampaignSend = await prisma.emailLog.findFirst({
    where: { emailAccountId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  const lastWarmupSend = await prisma.warmupLog.findFirst({
    where: { senderMailboxId: emailAccountId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  let lastSentAt: Date | null = null;
  if (lastCampaignSend?.sentAt && lastWarmupSend?.sentAt) {
    lastSentAt = lastCampaignSend.sentAt > lastWarmupSend.sentAt ? lastCampaignSend.sentAt : lastWarmupSend.sentAt;
  } else {
    lastSentAt = lastCampaignSend?.sentAt || lastWarmupSend?.sentAt || null;
  }

  if (lastSentAt) {
    const minWait = GLOBAL_MIN_WAIT_MS + jitterFor(lastSentAt.getTime());
    const elapsed = now.getTime() - lastSentAt.getTime();
    if (elapsed < minWait) {
      const secs = Math.ceil((minWait - elapsed) / 1000);
      return {
        allowed: false,
        reason: `A short pause between sends keeps your inbox reputation healthy. You can send again in ~${secs}s.`,
        retryAfterMs: minWait - elapsed,
      };
    }
  }

  return { allowed: true };
}
