import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";

// A warmup recipient can be either a platform-owned SeedInbox or another
// user's eligible mailbox ("peer"). This file owns the logic for picking a
// receiver and for determining which mailboxes are currently eligible to
// receive warmup traffic.

type Receiver =
  | { kind: "seed"; id: string; email: string }
  | { kind: "peer"; id: string; email: string };

export function isEntitledToWarmup(user: {
  plan: string;
  trialEndsAt: Date | null;
  trialVoided?: boolean;
  deletedAt?: Date | null;
}): boolean {
  if (user.deletedAt) return false;
  if (user.plan !== "free") return true;
  // Free users are entitled while on an active trial. Once the trial ends
  // (and they have not paid), warmup is paused.
  if (user.trialVoided) return false;
  return !!user.trialEndsAt && user.trialEndsAt.getTime() > Date.now();
}

// Platform seeds are always eligible if active. Peers are eligible only while
// their owner is on an active trial or a paid plan.
async function findPlatformSeed(
  excludeIds: Set<string>,
): Promise<Receiver | null> {
  const seeds = await prisma.seedInbox.findMany({
    where: { status: "active" },
    select: { id: true, email: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "asc" },
  });
  const candidates = seeds.filter(s => !excludeIds.has(s.id));
  if (candidates.length === 0) return null;
  return { kind: "seed", id: candidates[0].id, email: candidates[0].email };
}

async function findPeerReceiver(
  senderMailboxId: string,
  senderUserId: string,
  excludeIds: Set<string>,
): Promise<Receiver | null> {
  const recipients = await prisma.emailAccount.findMany({
    where: {
      status: "active",
      warmupEnabled: true,
      id: { not: senderMailboxId },
      // A customer's mailbox never warms against another mailbox belonging to
      // the SAME customer (too easily detected as self-warm). It only warms
      // against seeds and OTHER users' mailboxes.
      userId: { not: senderUserId },
      user: { deletedAt: null },
    },
    select: {
      id: true,
      email: true,
      lastHealthCheckAt: true,
      user: { select: { plan: true, trialEndsAt: true, trialVoided: true, deletedAt: true } },
    },
  });

  const eligible = recipients.filter(
    r => !excludeIds.has(r.id) && isEntitledToWarmup(r.user),
  );

  if (eligible.length === 0) return null;

  // Round-robin across the receiver pool: prefer the least-recently-used
  // eligible mailbox so individual inboxes aren't hammered. If every eligible
  // mailbox has been used recently, fall back to the full eligible set.
  const sorted = [...eligible].sort((a, b) =>
    (a.lastHealthCheckAt?.getTime() || 0) - (b.lastHealthCheckAt?.getTime() || 0),
  );

  const fresh = sorted.filter(r => {
    const last = r.lastHealthCheckAt?.getTime() || 0;
    return Date.now() - last > 24 * 60 * 60 * 1000;
  });
  const pool = fresh.length > 0 ? fresh : sorted;

  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool[idx];
  return { kind: "peer", id: picked.id, email: picked.email };
}

// Pick a warmup receiver for a sender. Priority:
//   1. Platform-owned seed pool (the always-available backbone)
//   2. Eligible peer mailboxes (other users on trial/paid)
// Scales the platform-seed vs peer split with pool size so the owned pool
// stays the primary backbone.
export async function pickWarmupReceiver(
  sender: { id: string; userId: string },
): Promise<Receiver | null> {
  // Avoid sending to the same receiver we used very recently.
  const recentLogs = await prisma.warmupLog.findMany({
    where: {
      senderMailboxId: sender.id,
      sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { seedMailboxId: true, seedInboxId: true },
    distinct: ["seedMailboxId", "seedInboxId"],
  });
  const exclude = new Set<string>();
  for (const l of recentLogs) {
    if (l.seedMailboxId) exclude.add(l.seedMailboxId);
    if (l.seedInboxId) exclude.add(l.seedInboxId);
  }

  const [seedCount, peerCount] = await Promise.all([
    prisma.seedInbox.count({ where: { status: "active" } }),
    prisma.emailAccount.count({
      where: {
        status: "active",
        warmupEnabled: true,
        id: { not: sender.id },
        user: { deletedAt: null },
      },
    }),
  ]);

  // Prefer platform seeds unless there are far more eligible peers than seeds,
  // in which case peers carry a larger share. Blend keeps the owned pool core.
  const seedShare = seedCount > 0 ? Math.min(1, seedCount / (seedCount + peerCount) + 0.3) : 0;

  let tries = 4;
  while (tries-- > 0) {
    if (seedCount > 0 && Math.random() < seedShare) {
      const seed = await findPlatformSeed(exclude);
      if (seed) return seed;
    }
    const peer = await findPeerReceiver(sender.id, sender.userId, exclude);
    if (peer) return peer;
  }

  // Last resort: any active platform seed even if recently used.
  const anySeed = await prisma.seedInbox.findFirst({
    where: { status: "active" },
    orderBy: { lastUsedAt: "asc" },
    select: { id: true, email: true },
  });
  if (anySeed) return { kind: "seed", id: anySeed.id, email: anySeed.email };

  return null;
}

export async function markReceiverUsed(id: string, kind: "seed" | "peer", at: Date): Promise<void> {
  if (kind === "seed") {
    await prisma.seedInbox.update({
      where: { id },
      data: { lastUsedAt: at },
    });
  } else {
    await prisma.emailAccount.update({
      where: { id },
      data: { lastHealthCheckAt: at },
    });
  }
}

export async function decryptSeed(seed: any): Promise<any> {
  return decryptAccount(seed);
}
