import { prisma } from "@/lib/prisma";
import { adjustmentFor, type WarmupHealthState } from "./health";

interface EmailAccountWithWarmup {
  id: string;
  email: string;
  warmupEnabled: boolean;
  warmupBase: number;
  warmupIncrease: number;
  warmupMax: number;
  warmupDays: number;
  warmupStartTime: string;
  warmupEndTime: string;
  minWaitTime: number;
  timezone: string;
  warmupPoolType: string;
  healthState: string;
  healthScore: number;
  isPaused: boolean;
  warmupWeek: number;
  currentDailyVolume: number;
  targetDailyVolume: number;
  warmupStartedAt: Date | null;
}

// FNV-1a hash for deterministic daily volume factor
function fnv1a(bytes: Uint8Array): number {
  let hash = BigInt("1469598103934665603");
  for (const b of bytes) {
    hash ^= BigInt(b);
    hash *= BigInt("1099511628211");
  }
  return Number(hash & BigInt("0xffffffff"));
}

function dailyVolumeFactor(accountId: string, day: Date): number {
  const d = new Date(day);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dayOfMonth = d.getUTCDate();
  const encoder = new TextEncoder();
  const bytes = encoder.encode(`${accountId}-${y}-${m}-${dayOfMonth}`);
  const hash = fnv1a(bytes);
  const u = (hash % 1000) / 1000;
  if (u < 0.15) return 0.6;
  return 0.75 + u * 0.35;
}

export function warmupRampTarget(
  warmupBase: number,
  warmupIncrease: number,
  warmupMax: number,
  daysWarming: number,
  _inCampaign: boolean,
): number {
  return Math.min(warmupBase + daysWarming * warmupIncrease, warmupMax);
}

function randomJitter(minMinutes: number, maxMinutes: number): number {
  return Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
}

function parseTimeOfDay(timeStr: string): number {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
}

function isWarmupDay(warmupDays: number, dayOfWeek: number): boolean {
  // warmupDays is a bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
  return (warmupDays & (1 << dayOfWeek)) !== 0;
}

function findNextValidDay(from: Date, warmupDays: number): Date {
  const next = new Date(from);
  for (let i = 0; i < 14; i++) {
    if (isWarmupDay(warmupDays, next.getDay())) return next;
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next;
}

function humanizeSeconds(dt: Date): Date {
  const s = Math.floor(Math.random() * 60);
  dt.setSeconds(s);
  dt.setMilliseconds(0);
  return dt;
}

function avoidRoundTimes(dt: Date): Date {
  const m = dt.getMinutes();
  if (m === 0) dt.setMinutes(Math.floor(Math.random() * 15) + 1);
  return dt;
}

function calculateFirstSlotTomorrow(startTime: string): Date {
  const startMinutes = parseTimeOfDay(startTime);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  return humanizeSeconds(tomorrow);
}

function calculateHoursRemainingUntil(endTime: string): number {
  const now = new Date();
  const endMinutes = parseTimeOfDay(endTime);
  const endDate = new Date(now);
  endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  const ms = endDate.getTime() - now.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

export async function calculateNextWarmupTime(accountId: string): Promise<Date | null> {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  }) as unknown as EmailAccountWithWarmup | null;

  if (!account) return null;
  if (account.isPaused) return null;
  if (!account.warmupEnabled && account.warmupStartedAt === null) return null;

  // Check if this mailbox backs a live campaign
  const activeCampaignLog = await prisma.emailLog.findFirst({
    where: {
      emailAccountId: accountId,
      lead: {
        campaign: { status: "active" },
      },
    },
    select: { id: true },
  });
  const inCampaign = !!activeCampaignLog;

  // Check if today is a valid warmup day
  const now = new Date();
  if (!isWarmupDay(account.warmupDays, now.getDay())) {
    return calculateFirstSlotTomorrow(account.warmupStartTime);
  }

  // Calculate target volume
  const daysWarming = account.warmupStartedAt
    ? Math.floor((Date.now() - new Date(account.warmupStartedAt).getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  let targetVolume = warmupRampTarget(
    account.warmupBase,
    account.warmupIncrease,
    account.warmupMax,
    daysWarming,
    inCampaign,
  );

  // Apply daily volume factor (deterministic per account+date)
  if (targetVolume > 0) {
    const factor = dailyVolumeFactor(accountId, now);
    let varied = Math.round(targetVolume * factor);
    varied = Math.max(varied, account.warmupBase);
    varied = Math.max(varied, 1);
    if (varied < targetVolume) targetVolume = varied;
  }

  // Cap to eligible seeds
  const seedCount = await prisma.seedMailbox.count({ where: { isActive: true } });
  if (seedCount > 0 && targetVolume > seedCount) {
    targetVolume = seedCount;
  }

  // Apply health state adjustments
  const adj = adjustmentFor(account.healthState as WarmupHealthState);
  if (adj.volumeMultiplier < 1.0) {
    let adjusted = Math.round(targetVolume * adj.volumeMultiplier);
    const floor = account.warmupBase;
    adjusted = Math.max(adjusted, floor, 1);
    targetVolume = adjusted;
  }

  const minWaitSeconds = Math.round(account.minWaitTime * adj.minWaitMultiplier);

  // Count emails sent today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const emailsSentToday = await prisma.warmupLog.count({
    where: {
      senderMailboxId: accountId,
      sentAt: { gte: todayStart },
    },
  });

  if (emailsSentToday >= targetVolume) {
    return calculateFirstSlotTomorrow(account.warmupStartTime);
  }

  // Calculate spacing
  const remaining = targetVolume - emailsSentToday;
  const hoursRemaining = calculateHoursRemainingUntil(account.warmupEndTime);

  if (hoursRemaining <= 0) {
    return calculateFirstSlotTomorrow(account.warmupStartTime);
  }

  const idealIntervalHours = hoursRemaining / remaining;

  // Get last send time
  const lastLog = await prisma.warmupLog.findFirst({
    where: { senderMailboxId: accountId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  let earliestNext = now;
  if (lastLog?.sentAt) {
    const minWait = minWaitSeconds * 1000;
    const minNext = new Date(lastLog.sentAt.getTime() + minWait);
    if (minNext > now) earliestNext = minNext;
  }

  // Add varied ideal interval
  if (lastLog?.sentAt && idealIntervalHours > 0) {
    const varied = idealIntervalHours * (0.55 + Math.random() * 0.9);
    const idealNext = new Date(lastLog.sentAt.getTime() + varied * 60 * 60 * 1000);
    if (idealNext > earliestNext) earliestNext = idealNext;
  }

  // Add jitter
  const jitter = randomJitter(-15, 15);
  let candidateTime = new Date(earliestNext.getTime() + jitter * 60 * 1000);

  candidateTime = avoidRoundTimes(candidateTime);

  // Ensure within window
  const startMinutes = parseTimeOfDay(account.warmupStartTime);
  const endMinutes = parseTimeOfDay(account.warmupEndTime);
  const candidateMinutes = candidateTime.getHours() * 60 + candidateTime.getMinutes();

  if (candidateMinutes < startMinutes) {
    candidateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    candidateTime = new Date(candidateTime.getTime() + Math.random() * 30 * 60 * 1000);
  } else if (candidateMinutes >= endMinutes) {
    return calculateFirstSlotTomorrow(account.warmupStartTime);
  }

  // Final day-of-week guard
  if (!isWarmupDay(account.warmupDays, candidateTime.getDay())) {
    const validDay = findNextValidDay(candidateTime, account.warmupDays);
    validDay.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    candidateTime = new Date(validDay.getTime() + randomJitter(0, 60) * 60 * 1000);
  }

  return humanizeSeconds(candidateTime);
}

export async function scheduleNextWarmupSend(accountId: string): Promise<Date | null> {
  const nextTime = await calculateNextWarmupTime(accountId);
  if (!nextTime) return null;

  // Store as pending warmup log entry
  await prisma.warmupLog.create({
    data: {
      senderMailboxId: accountId,
      seedMailboxId: "", // Will be assigned when sent
      status: "scheduled",
      sentAt: nextTime,
    },
  });

  return nextTime;
}
