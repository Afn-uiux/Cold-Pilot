import { prisma } from "./prisma";

// Retention (audit L-4): attempt rows are bounded data — they exist for admin
// forensics, not archaeology. Anything older than 90 days is pruned, and the
// prune itself is throttled to once a day per process so every login doesn't
// pay for a deleteMany. Best-effort, never throws.
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastPruneAt = 0;

export async function pruneLoginAttempts(now = Date.now()): Promise<void> {
  try {
    if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
    await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
    });
    lastPruneAt = now;
  } catch {
    // Pruning is best-effort.
  }
}

// Records a login attempt for admin visibility (see /admin/login-attempts).
// Never throws and never blocks the login itself — a storage failure must not
// break authentication.
export async function logLoginAttempt(input: {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  reason: string;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: (input.email || "").trim().toLowerCase().slice(0, 320),
        ip: input.ip && input.ip !== "unknown" ? input.ip.slice(0, 64) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 300) : null,
        success: input.success,
        reason: input.reason,
      },
    });
  } catch {
    // Logging is best-effort.
  }
  await pruneLoginAttempts();
}