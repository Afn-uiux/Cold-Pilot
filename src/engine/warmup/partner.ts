import { prisma } from "@/lib/prisma";

export async function pickWarmupPartner(
  senderMailboxId: string,
  senderPoolType: string,
  activeSenderCount: number,
): Promise<{ id: string; email: string } | null> {
  const recentPartners = await prisma.warmupLog.findMany({
    where: {
      senderMailboxId,
      sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { seedMailboxId: true },
    distinct: ["seedMailboxId"],
  });
  const recentIds = new Set(recentPartners.map(r => r.seedMailboxId));

  // Try to find a seed not used in the last 24h
  const seeds = await prisma.seedMailbox.findMany({
    where: { isActive: true },
    select: { id: true, email: true, lastUsed: true },
    orderBy: { lastUsed: "asc" },
  });

  // Filter: prefer seeds not used recently, also avoid senders warming to themselves
  const candidates = seeds.filter(s => !recentIds.has(s.id));
  const pool = candidates.length > 0 ? candidates : seeds;

  if (pool.length === 0) return null;

  // Pick randomly, weighted toward least-recently-used
  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool[idx];

  return { id: picked.id, email: picked.email };
}
