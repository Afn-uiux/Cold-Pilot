import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const LOCK_TTL_MS = 10 * 60 * 1000;

function now() {
  return new Date();
}

/**
 * Distributed leader election for background work.
 *
 * Acquire (or renew) the lease for `key`. Returns true when this process is
 * the current leader. Safe for concurrent processes: the conditional
 * updateMany only takes a lock that is already expired or owned by this
 * token; the create fails with a unique-constraint error if another process
 * won the race in between.
 */
export async function acquireLock(
  key: string,
  token: string,
  ttlMs: number = LOCK_TTL_MS
): Promise<boolean> {
  const expiresAt = new Date(now().getTime() + ttlMs);

  const taken = await prisma.schedulerLock.updateMany({
    where: {
      key,
      OR: [{ expiresAt: { lt: now() } }, { token }],
    },
    data: { token, expiresAt },
  });

  if (taken.count > 0) return true;

  try {
    await prisma.schedulerLock.create({ data: { key, token, expiresAt } });
    return true;
  } catch {
    return false;
  }
}

export function newLeaderToken(): string {
  return crypto.randomBytes(16).toString("hex");
}
