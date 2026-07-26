import { prisma } from "@/lib/prisma";
import { sendEmailSafe } from "./email/send";

const GLOBAL_MIN_WAIT_MS = 60 * 1000; // 60 seconds between any sends from same account

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
      reason: `Daily limit reached (${totalSentToday}/${dailySendLimit})`,
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
    const elapsed = now.getTime() - lastSentAt.getTime();
    if (elapsed < GLOBAL_MIN_WAIT_MS) {
      return {
        allowed: false,
        reason: `Min wait not met (${Math.ceil((GLOBAL_MIN_WAIT_MS - elapsed) / 1000)}s remaining)`,
        retryAfterMs: GLOBAL_MIN_WAIT_MS - elapsed,
      };
    }
  }

  return { allowed: true };
}
