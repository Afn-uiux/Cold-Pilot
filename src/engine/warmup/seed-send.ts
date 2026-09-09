import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { sendWarmupEmail } from "./sender";
import { isEntitledToWarmup, isHealthyPeerReceiver } from "./pool";
import { parseSeedTags, spinSubjectTag } from "@/lib/seed-tags";

function parseTimeOfDay(str: string): number {
  const p = (str || "09:00").split(":");
  return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0);
}

function inSchedule(seed: any, now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeOfDay(seed.scheduleStart);
  const end = parseTimeOfDay(seed.scheduleEnd);
  if (end <= start) return minutes >= start || minutes < end; // overnight window
  return minutes >= start && minutes < end;
}

async function seedSentToday(seedId: string, todayStart: Date): Promise<number> {
  return prisma.warmupLog.count({
    where: { senderInboxId: seedId, sentAt: { gte: todayStart } },
  });
}

async function lastSeedSendAt(seedId: string): Promise<Date | null> {
  const log = await prisma.warmupLog.findFirst({
    where: { senderInboxId: seedId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  return log?.sentAt ?? null;
}

// Seed-to-seed (and seed-to-customer) sending: lets the platform-owned seed
// network warm ITSELF even when no customers are on the platform. Seeds send
// warmup to other seeds, and also to eligible customer mailboxes, so the pool
// stays active. This is what makes the network self-sustaining while idle.

const SEED_SUBJECTS = [
  "Quick question",
  "Following up",
  "Hope you're well",
  "A thought for you",
  "Re: our chat",
  "Checking in",
  "Saw this and thought of you",
  "Small update",
];

const SEED_BODIES = [
  "Hey,\n\nJust wanted to follow up on this. Let me know when you get a chance to look.\n\nBest,\n{name}",
  "Hi,\n\nHope you're having a good week. Figured I'd reach out to see if you had any thoughts on this.\n\nCheers,\n{name}",
  "Hello,\n\nWanted to circle back on the thing we touched on. Happy to jump on a call if useful.\n\nThanks,\n{name}",
  "Hi,\n\nCame across this recently and thought you might find it interesting. Let me know what you think.\n\nBest regards,\n{name}",
  "Hey,\n\nJust a quick note to keep in touch. No rush on anything — wanted to stay connected.\n\nTalk soon,\n{name}",
];

function seedContent(senderName: string, tags: string[] = [], filterTag = ""): { subject: string; body: string } {
  let subject = SEED_SUBJECTS[Math.floor(Math.random() * SEED_SUBJECTS.length)];
  let body = SEED_BODIES[Math.floor(Math.random() * SEED_BODIES.length)].replace(
    "{name}",
    senderName || "Sincerely",
  );
  // Spin the seed's tags into the content: one random tag rides the subject
  // line, the full set closes the body. Every warmup email then carries
  // unique content (identical bodies at volume are a spam-filter signal).
  // Seeds without tags send the base templates unchanged.
  const tagList = parseSeedTags(tags);
  if (tagList.length > 0) {
    const subjectTag = spinSubjectTag(tagList);
    if (subjectTag) subject = `${subject} ${subjectTag}`;
    body = `${body}\n\n${tagList.join(" ")}`;
  }
  // Per-seed tracking code (mirrors EmailAccount.warmupFilterTag): appended
  // to the subject and stamped on its own final body line so the seed's mail
  // is findable/filterable in any inbox. Skipped when unset.
  const code = (filterTag || "").trim();
  if (code) {
    subject = `${subject} ${code}`;
    body = `${body}\n${code}`;
  }
  return { subject, body };
}

type Sender = {
  id: string;
  email: string;
  displayName: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  dailyTarget?: number;
  warmupBase?: number;
  warmupIncrease?: number;
  warmupStartedAt?: Date | null;
  scheduleStart?: string;
  scheduleEnd?: string;
  minWaitMinutes?: number;
};

function rampedDailyTarget(seed: Sender): number {
  const cap = seed.dailyTarget ?? 10;
  const base = seed.warmupBase ?? 2;
  const increase = seed.warmupIncrease ?? 1;
  const startedAt = seed.warmupStartedAt || new Date();
  const daysWarming = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / (24 * 60 * 60 * 1000)));
  return Math.min(base + daysWarming * increase, cap);
}

function randomDelayMs(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Receiver =
  | { kind: "seed"; id: string; email: string }
  | { kind: "peer"; id: string; email: string };

// Mild per-seed "weight" derived from its id. Seeds with higher weight get
// chosen as receivers a bit more often, so receives are slightly uneven but
// stay within a safe band — no seed ever receives dramatically more than the
// average. Deterministic so the skew stays consistent day-to-day.
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function receiverWeight(seedId: string): number {
  const h = fnv1a(seedId);
  // Narrow band ~0.85 .. 1.35 (max ~1.6x the average) — a mild skew, not a flood.
  const u = (h % 10000) / 10000; // 0..1
  return 0.85 + u * 0.5;
}

async function pickWeightedSeed(
  candidates: Array<{ id: string; email: string }>,
): Promise<{ id: string; email: string }> {
  const weights = candidates.map(c => receiverWeight(c.id));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return { id: candidates[i].id, email: candidates[i].email };
  }
  return { id: candidates[candidates.length - 1].id, email: candidates[candidates.length - 1].email };
}

async function receivedToday(seedId: string, todayStart: Date): Promise<number> {
  return prisma.warmupLog.count({
    where: { seedInboxId: seedId, receivedAt: { gte: todayStart } },
  });
}

async function pickReceiver(
  excludeIds: Set<string>,
  _seedsCount: number,
  receiveCap: number,
  todayStart: Date,
): Promise<Receiver | null> {
  // May send to another seed OR an eligible customer mailbox.
  const seeds = await prisma.seedInbox.findMany({
    where: { status: "active" },
    select: { id: true, email: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "asc" },
  });
  // Exclude receivers already at their receive cap so no seed gets flooded.
  const candidates = [];
  for (const s of seeds) {
    if (excludeIds.has(s.id)) continue;
    if (await receivedToday(s.id, todayStart) >= receiveCap) continue;
    candidates.push(s);
  }
  if (candidates.length > 0) {
    const s = await pickWeightedSeed(candidates);
    return { kind: "seed", id: s.id, email: s.email };
  }

  const peers = await prisma.emailAccount.findMany({
    where: { status: "active", warmupEnabled: true, deletedAt: null, user: { deletedAt: null } },
    select: {
      id: true,
      email: true,
      healthScore: true,
      healthState: true,
      warmupBounceFlag: true,
      user: { select: { plan: true, trialEndsAt: true, trialVoided: true, deletedAt: true } },
    },
  });
  const eligiblePeers = peers.filter(
    p => !excludeIds.has(p.id) && isEntitledToWarmup(p.user) && isHealthyPeerReceiver(p),
  );
  if (eligiblePeers.length === 0) return null;
  const p = eligiblePeers[Math.floor(Math.random() * eligiblePeers.length)];
  return { kind: "peer", id: p.id, email: p.email };
}

export async function processSeedSends(): Promise<{ sent: number; failed: number }> {
  const rawSeeds = await prisma.seedInbox.findMany({ where: { status: "active" } });
  const seeds = rawSeeds
    .map(s => decryptAccount(s) as any)
    .filter(
      (s: any) =>
        s.smtpHost && s.smtpPort && s.smtpUser && s.smtpPass,
    ) as Sender[];

  if (seeds.length === 0) return { sent: 0, failed: 0 };

  // Avoid a seed sending to a receiver it used in the last 24h.
  const recentLogs = await prisma.warmupLog.findMany({
    where: {
      senderInboxId: { in: seeds.map(s => s.id) },
      sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { senderInboxId: true, seedMailboxId: true, seedInboxId: true },
    distinct: ["senderInboxId", "seedMailboxId", "seedInboxId"],
  });
  const recentBySeed = new Map<string, Set<string>>();
  for (const l of recentLogs) {
    if (!l.senderInboxId) continue;
    if (!recentBySeed.has(l.senderInboxId)) recentBySeed.set(l.senderInboxId, new Set());
    const set = recentBySeed.get(l.senderInboxId)!;
    if (l.seedMailboxId) set.add(l.seedMailboxId);
    if (l.seedInboxId) set.add(l.seedInboxId);
  }

  let sent = 0;
  let failed = 0;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  for (const seed of seeds) {
    // Respect warmup schedule window
    if (!inSchedule(seed, now)) continue;

    // Respect min wait between sends
    const lastAt = await lastSeedSendAt(seed.id);
    if (lastAt) {
      const minWait = (seed.minWaitMinutes ?? 10) * 60 * 1000;
      if (now.getTime() - lastAt.getTime() < minWait) continue;
    }

    // Respect daily target (ramped: starts low, grows to cap)
    const sentToday = await seedSentToday(seed.id, todayStart);
    const target = rampedDailyTarget(seed);
    if (sentToday >= target) continue;

    // Humanizing cadence: only send if this seed is behind its smooth
    // daily pace, so sends come in irregular bursts rather than on a
    // fixed clockwork interval. Skip sending when it is at or ahead of
    // the pace it should be at for this point in the schedule window.
    const endMin = parseTimeOfDay(seed.scheduleEnd || "17:00");
    const startMin = parseTimeOfDay(seed.scheduleStart || "09:00");
    const windowLen = Math.max(60, endMin - startMin);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const fraction = Math.max(0, Math.min(1, (nowMin - startMin) / windowLen));
    const expectsByNow = fraction * target;
    const slack = Math.max(1, Math.round(expectsByNow * 0.4));
    if (sentToday > expectsByNow + slack) {
      // Already ahead of pace — let some time pass without sending.
      continue;
    }

    // Random bleed-time before the actual send so multiple seeds (or a
    // seed sending again later) don't fire at the same instant.
    if (Math.random() < 0.8) {
      await new Promise(r => setTimeout(r, randomDelayMs(0, 120_000)));
    }

    const exclude = recentBySeed.get(seed.id) || new Set<string>();
    exclude.add(seed.id); // never send to itself
    // Hard ceiling on how many warmups any seed can receive in a day, so no
    // inbox ever gets flooded. Stays modest (well below a flood signal).
    const receiver = await pickReceiver(exclude, seeds.length, 15, todayStart);
    if (!receiver) continue;

    const { subject, body } = seedContent(
      seed.displayName || seed.email,
      parseSeedTags((seed as any).tags ?? []),
      String((seed as any).filterTag ?? ""),
    );

    const result = await sendWarmupEmail(
      seed.email,
      seed.smtpHost,
      seed.smtpPort,
      seed.smtpUser,
      seed.smtpPass,
      seed.displayName || undefined,
      receiver.email,
      subject,
      body,
    );

    if (result.success) {
      const data: any = {
        senderInboxId: seed.id,
        subject,
        bodyPreview: body.slice(0, 200),
        sentAt: new Date(),
        messageId: result.messageId,
        status: "sent",
      };
      if (receiver.kind === "seed") data.seedInboxId = receiver.id;
      else data.seedMailboxId = receiver.id;

      await prisma.warmupLog.create({ data });
      await prisma.seedInbox.update({ where: { id: seed.id }, data: { lastUsedAt: new Date() } });
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}
