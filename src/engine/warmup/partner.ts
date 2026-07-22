import { prisma } from "@/lib/prisma";

export async function pickWarmupPartner(
  senderMailboxId: string,
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

  const accounts = await prisma.emailAccount.findMany({
    where: {
      status: "active",
      warmupEnabled: true,
      id: { not: senderMailboxId },
    },
    select: { id: true, email: true },
  });

  if (accounts.length === 0) return null;

  const candidates = accounts.filter(a => !recentIds.has(a.id));
  const pool = candidates.length > 0 ? candidates : accounts;

  if (pool.length === 0) return null;

  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool[idx];

  return { id: picked.id, email: picked.email };
}
