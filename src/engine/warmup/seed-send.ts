import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { sendWarmupEmail } from "./sender";
import { isEntitledToWarmup, isHealthyPeerReceiver } from "./pool";
import { parseSeedTags } from "@/lib/seed-tags";
import { generateSeedWarmupContent } from "./content";

function parseTimeOfDay(str: string): number {
  const p = (str || "09:00").split(":");
  return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0);
}

// Warmup day resets at 09:00 (server/Nigerian time) and a day's warmups trickle
// out across the following 24 hours — instantly.ai does the same with a
// 12:00 AM UTC reset. Daily-schedule offsets below are measured in
// minutes-after-this-reset (0..1440).
export const WARMUP_RESET_MIN = 9 * 60;

function inSchedule(seed: any, now: Date): boolean {
  // Default: trickle across the full 24h warmup day (no hard window). An
  // explicitly-set scheduleStart/scheduleEnd still narrows it to a tighter
  // window for that seed.
  if (typeof seed.scheduleStart !== "string" && typeof seed.scheduleEnd !== "string") return true;
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

// Hard floor between ANY two seed warmup sends, no matter which seed or tick
// fires them. Without this, seeds share the same schedule window and can all
// send within the same minute (a spam-filter "blast" signal). Consecutive
// SMTP sends are therefore >1 minute apart, always.
const MIN_SEED_GAP_MS = 60_000;
let lastGridSendAt = 0;

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

// Most recent warmup sent from ANY seed within the gap window. Enforced before
// each actual SMTP send so cross-seed spacing holds across ticks/restarts, not
// just within a single run of this function.
async function latestSeedSendAt(gapMs: number): Promise<Date | null> {
  const log = await prisma.warmupLog.findFirst({
    where: {
      senderInboxId: { not: null },
      sentAt: { gte: new Date(Date.now() - gapMs) },
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  return log?.sentAt ?? null;
}

// Small deterministic PRNG (mulberry32) so a seed's daily schedule is stable
// per seed+date but pseudo-random across seeds and days.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-seed send times for a warmup day, as minutes-after-reset
// (0..1440 across the 24h day that starts at 09:00). The day is split into
// `target` equal slots and one random offset is drawn per slot, so a seed's
// sends are hours apart (e.g. target 2 → ~12h apart; target 10 → ~2.4h) and
// trickle throughout the day like instantly.ai. Different seeds and days get
// different draws, so no two seeds are ever synchronized. An explicit per-seed
// window (scheduleStart/scheduleEnd) narrows the trickle to those hours.
function dailySendSchedule(
  seedId: string,
  dateKey: string,
  target: number,
  startMin: number,
  endMin: number,
): number[] {
  if (target <= 0) return [];
  // Window is wall-clock, the day resets at 09:00: express both edges in
  // minutes-after-reset (mod 1440) so windows before 09:00 (00:00-08:59) and
  // overnight windows (22:00-07:00) map onto the right slice of the warmup day.
  const from = ((startMin - WARMUP_RESET_MIN) % 1440 + 1440) % 1440;
  let to = ((endMin - WARMUP_RESET_MIN) % 1440 + 1440) % 1440;
  if (to <= from) to += 1440; // window wraps past midnight (in reset-relative time)
  const windowLen = Math.max(1, Math.min(1440, to - from));
  const rnd = mulberry32(fnv1a(`${seedId}|send|${dateKey}`));
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const slotLen = windowLen / target;
    out.push(Math.min(1439, Math.floor(from + i * slotLen + rnd() * slotLen)));
  }
  return out;
}

// Minimum gap between one seed's own sends: at least 30 minutes, randomized
// 30-60min (deterministic per seed + last send time, so the chosen gap never
// shifts while the tick loop retries). Honors a higher configured
// minWaitMinutes.
function nextSeedSendAt(seedId: string, lastAt: Date, configuredMin?: number | null): Date {
  const floor = Math.max(30, configuredMin ?? 30);
  const rnd = mulberry32(fnv1a(`${seedId}|gap|${lastAt.getTime()}`));
  const gapMin = Math.floor(floor + rnd() * Math.max(1, 60 - floor));
  return new Date(lastAt.getTime() + gapMin * 60_000);
}

async function receivedToday(seedId: string, todayStart: Date): Promise<number> {
  return prisma.warmupLog.count({
    where: { seedInboxId: seedId, receivedAt: { gte: todayStart } },
  });
}

async function peerReceivedToday(peerId: string, todayStart: Date): Promise<number> {
  return prisma.warmupLog.count({
    where: { seedMailboxId: peerId, sentAt: { gte: todayStart } },
  });
}

// Peer (customer) inbound cap derived from their own warmup ramp — a mailbox's
// inbox should never receive more warmup per day than its own warmup ceiling
// (clamped to a modest, conservative band).
function peerReceiveCap(peer: { warmupMax?: number; currentDailyVolume?: number }): number {
  const max = Math.max(2, peer.warmupMax || peer.currentDailyVolume || 10);
  return Math.min(15, max);
}

// Receivers are drawn from BOTH the platform seed pool and every eligible
// warmup-enabled customer mailbox, so seeds and customer inboxes warm each
// other in both directions. Seeds carry a mild weight bias — the owned pool
// stays the self-sustaining backbone even with zero customers — but customers
// are always in the running once their warmup is on.
async function pickReceiver(
  excludeIds: Set<string>,
  _seedsCount: number,
  receiveCap: number,
  todayStart: Date,
): Promise<Receiver | null> {
  const seeds = await prisma.seedInbox.findMany({
    where: { status: "active" },
    select: { id: true, email: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "asc" },
  });
  // Exclude receivers already at their receive cap so no seed gets flooded.
  const seedPool: Array<{ id: string; email: string }> = [];
  for (const s of seeds) {
    if (excludeIds.has(s.id)) continue;
    if (await receivedToday(s.id, todayStart) >= receiveCap) continue;
    seedPool.push({ id: s.id, email: s.email });
  }

  // Eligible customer mailboxes: warmup on, entitled (trial/paid), healthy as
  // receivers, not used recently, and under their own inbound cap.
  const peers = await prisma.emailAccount.findMany({
    where: { status: "active", warmupEnabled: true, deletedAt: null, user: { deletedAt: null } },
    select: {
      id: true,
      email: true,
      warmupMax: true,
      currentDailyVolume: true,
      healthScore: true,
      healthState: true,
      warmupBounceFlag: true,
      user: { select: { plan: true, trialEndsAt: true, trialVoided: true, deletedAt: true } },
    },
  });
  const peerPool: Array<{ id: string; email: string }> = [];
  for (const p of peers) {
    if (excludeIds.has(p.id)) continue;
    if (!isEntitledToWarmup(p.user) || !isHealthyPeerReceiver(p)) continue;
    if (await peerReceivedToday(p.id, todayStart) >= peerReceiveCap(p)) continue;
    peerPool.push({ id: p.id, email: p.email });
  }

  if (seedPool.length === 0 && peerPool.length === 0) return null;

  // Weighted pick across the merged pool. All mailbox types share the equal
  // per-id weighting — the selection split follows the actual pool composition,
  // so seeds dominate when the platform is idle and customers carry more of the
  // traffic as their numbers grow. Flooding is already bounded by the per-type
  // receive caps above, so no extra bias is needed.
  const pool = [
    ...seedPool.map(c => ({ c, weight: receiverWeight(c.id), kind: "seed" as const })),
    ...peerPool.map(c => ({ c, weight: receiverWeight(c.id), kind: "peer" as const })),
  ];
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return { kind: p.kind, id: p.c.id, email: p.c.email };
  }
  const last = pool[pool.length - 1];
  return { kind: last.kind, id: last.c.id, email: last.c.email };
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
  // Warmup day = the most recent 09:00 (server/Nigerian time). Counts and the
  // daily schedule both reset here; the day's warmups then trickle over the
  // next 24h, instantly.ai style.
  const todayStart = new Date(now);
  todayStart.setHours(9, 0, 0, 0);
  if (todayStart.getTime() > now.getTime()) todayStart.setDate(todayStart.getDate() - 1);

  for (const seed of seeds) {
    // Respect warmup schedule window
    if (!inSchedule(seed, now)) continue;

    // Respect min wait between sends: at least 30 minutes, randomized 30-60min.
    // The floor only binds WITHIN a warmup day — last night's 22:30 send must
    // not block this morning's first slot after the 09:00 reset, or seeding
    // drifts to midnight and custom windows become unreachable.
    const lastAt = await lastSeedSendAt(seed.id);
    if (lastAt && lastAt >= todayStart && now.getTime() < nextSeedSendAt(seed.id, lastAt, seed.minWaitMinutes).getTime()) continue;

    // Respect daily target (ramped: starts low, grows to cap)
    const sentToday = await seedSentToday(seed.id, todayStart);
    const target = rampedDailyTarget(seed);
    if (sentToday >= target) continue;

    // Daily cadence: each seed has deterministic send times for its 24h warmup
    // day, drawn randomly one-per-slot across the whole window (default: the
    // full 24h from 09:00). Different seeds and days get different draws, and
    // sends land hours apart — no synchronized blast. sentToday tells us which
    // scheduled slot is next.
    const startMin = seed.scheduleStart ? parseTimeOfDay(seed.scheduleStart) : WARMUP_RESET_MIN;
    const endMin = seed.scheduleEnd ? parseTimeOfDay(seed.scheduleEnd) : WARMUP_RESET_MIN + 1440;
    const dateKey = `${todayStart.getFullYear()}-${todayStart.getMonth() + 1}-${todayStart.getDate()}`;
    const schedule = dailySendSchedule(seed.id, dateKey, target, startMin, endMin);
    if (sentToday >= schedule.length) continue;
    const nowOffset = ((now.getHours() * 60 + now.getMinutes()) - WARMUP_RESET_MIN + 1440) % 1440;
    if (nowOffset < schedule[sentToday]) {
      // This scheduled time hasn't come yet — let the day proceed.
      continue;
    }

    const exclude = recentBySeed.get(seed.id) || new Set<string>();
    exclude.add(seed.id); // never send to itself
    // Hard ceiling on how many warmups any seed can receive in a day, so no
    // inbox ever gets flooded. Stays modest (well below a flood signal).
    const receiver = await pickReceiver(exclude, seeds.length, 15, todayStart);
    if (!receiver) continue;

    // Cross-seed spacing floor: wait until the grid is free before actually
    // firing, so multiple due seeds never transmit in the same second. The
    // in-process clock plus the DB's most-recent send cover restarts and
    // overlapping ticks alike.
    const dbLatest = await latestSeedSendAt(MIN_SEED_GAP_MS);
    const waitUntil = Math.max(lastGridSendAt, dbLatest ? dbLatest.getTime() : 0) + MIN_SEED_GAP_MS;
    if (waitUntil > Date.now()) {
      await new Promise(r => setTimeout(r, waitUntil - Date.now()));
    }
    lastGridSendAt = Date.now();

    const { subject, body } = await generateSeedWarmupContent(
      seed.id,
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
