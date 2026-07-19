import { prisma } from "@/lib/prisma";

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

  // Count total sends today (campaign + warmup combined)
  const totalSentToday = await prisma.emailLog.count({
    where: {
      emailAccountId,
      sentAt: { gte: todayStart },
    },
  });

  if (totalSentToday >= dailySendLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${totalSentToday}/${dailySendLimit})`,
    };
  }

  // Check time since last send from this account
  const lastSend = await prisma.emailLog.findFirst({
    where: { emailAccountId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  if (lastSend?.sentAt) {
    const elapsed = now.getTime() - lastSend.sentAt.getTime();
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
