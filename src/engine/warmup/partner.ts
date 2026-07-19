import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";

const MAX_INBOX_MESSAGES = 50000;
const VALIDATION_TTL_MS = 60 * 60 * 1000; // 1 hour

const validationCache = new Map<string, { valid: boolean; checkedAt: number }>();

async function validateSeed(seed: {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
}): Promise<boolean> {
  const cached = validationCache.get(seed.id);
  if (cached && Date.now() - cached.checkedAt < VALIDATION_TTL_MS) {
    return cached.valid;
  }

  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: seed.imapHost,
      port: seed.imapPort,
      secure: true,
      auth: { user: seed.imapUser, pass: seed.imapPass },
      logger: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
    await client.connect();

    // Check INBOX is accessible and not over capacity
    const status = await client.status("INBOX", { messages: true });
    const count = status.messages ?? 0;
    if (count > MAX_INBOX_MESSAGES) {
      await client.logout();
      validationCache.set(seed.id, { valid: false, checkedAt: Date.now() });
      return false;
    }

    await client.logout();
    validationCache.set(seed.id, { valid: true, checkedAt: Date.now() });
    return true;
  } catch (err) {
    console.error(`Seed validation failed for ${seed.email}:`, err);
    if (client) {
      try { await client.logout(); } catch {}
    }
    validationCache.set(seed.id, { valid: false, checkedAt: Date.now() });
    return false;
  }
}

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

  const rawSeeds = await prisma.seedMailbox.findMany({
    where: { isActive: true },
    select: { id: true, email: true, lastUsed: true, imapHost: true, imapPort: true, imapUser: true, imapPass: true },
    orderBy: { lastUsed: "asc" },
  });
  const seeds = rawSeeds.map(s => decryptAccount(s) as typeof s);

  // Validate seeds via IMAP before using
  const validSeeds: typeof seeds = [];
  const invalidIds: string[] = [];
  for (const seed of seeds) {
    const ok = await validateSeed(seed);
    if (ok) {
      validSeeds.push(seed);
    } else {
      invalidIds.push(seed.id);
    }
  }

  // Deactivate invalid seeds
  if (invalidIds.length > 0) {
    await prisma.seedMailbox.updateMany({
      where: { id: { in: invalidIds } },
      data: { isActive: false },
    });
  }

  if (validSeeds.length === 0) return null;

  // Filter: prefer seeds not used recently, also avoid senders warming to themselves
  const candidates = validSeeds.filter(s => !recentIds.has(s.id));
  const pool = candidates.length > 0 ? candidates : validSeeds;

  if (pool.length === 0) return null;

  // Pick randomly, weighted toward least-recently-used
  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool[idx];

  return { id: picked.id, email: picked.email };
}
