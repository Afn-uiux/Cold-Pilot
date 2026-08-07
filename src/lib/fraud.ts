import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mailbox identity
// ---------------------------------------------------------------------------

// Normalizes an email to the immutable identity that survives alias games
// (Gmail's "+alias" AND dot-insensitivity are both stripped, since Gmail
// treats "john.doe@gmail.com" and "johndoe@gmail.com" as the exact same
// inbox — leaving either trick unhandled would defeat the whole point of
// this function) and casing differences. All plain IMAP/app password
// connects share the "imap" identity space so gmail-via-app-password and
// gmail-via-custom-imap are the same mailbox.
export function mailboxIdentityKey(email: string): { provider: string; providerAccountId: string } {
  let e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at >= 0) {
    let local = e.slice(0, at);
    let domain = e.slice(at);
    if (domain === "@googlemail.com") domain = "@gmail.com";
    if (domain === "@gmail.com") {
      if (local.includes("+")) local = local.slice(0, local.indexOf("+"));
      local = local.replace(/\./g, "");
    }
    e = local + domain;
  }
  return { provider: "imap", providerAccountId: e };
}

// Records a mailbox connect. If this mailbox was first claimed by a different
// profile, the connecting account's trial is permanently voided. The first
// profile keeps ownership forever (survives disconnects and account deletion),
// so reusing a mailbox is never a route to a fresh trial.
export async function recordMailboxConnect(opts: {
  userId: string;
  provider: string;
  providerAccountId: string;
  email: string;
}): Promise<void> {
  const identity = await prisma.mailboxIdentity.upsert({
    where: {
      provider_providerAccountId: {
        provider: opts.provider,
        providerAccountId: opts.providerAccountId,
      },
    },
    create: {
      provider: opts.provider,
      providerAccountId: opts.providerAccountId,
      email: opts.email.trim().toLowerCase(),
      firstSeenUserId: opts.userId,
      lastConnectedAt: new Date(),
    },
    update: {
      lastConnectedAt: new Date(),
      disconnectedAt: null,
    },
  });

  if (identity.firstSeenUserId !== opts.userId) {
    await voidTrial(opts.userId, "mailbox_reuse");
  }
}

export async function markMailboxDisconnected(provider: string, providerAccountId: string): Promise<void> {
  await prisma.mailboxIdentity.updateMany({
    where: { provider, providerAccountId },
    data: {
      disconnectedAt: new Date(),
      disconnectCount: { increment: 1 },
    },
  });
}

// ---------------------------------------------------------------------------
// Trial void
// ---------------------------------------------------------------------------

// Permanently voids a user's trial (and signup credits). Sticky: voidTrial is
// guarded by trialVoided so it can only ever fire once, closing the
// disconnect/reconnect loophole.
export async function voidTrial(userId: string, reason: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, trialVoided: true, trialEndsAt: true, creditBalance: true },
  });
  if (!user || user.trialVoided) return;

  const now = new Date();
  const data: Prisma.UserUpdateInput = {
    trialVoided: true,
    trialVoidReason: reason,
    trialVoidedAt: now,
    signupCreditsGranted: true,
  };
  if (user.trialEndsAt && user.trialEndsAt.getTime() > now.getTime()) {
    data.trialEndsAt = now;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data });
    // Only claw back free signup credits; purchased credits are left alone.
    if (user.plan === "free" && user.creditBalance > 0) {
      await tx.creditTransaction.create({
        data: { userId, amount: -user.creditBalance, reason: "trial_voided", refId: reason },
      });
      await tx.user.update({ where: { id: userId }, data: { creditBalance: 0 } });
    }
  });
}

// ---------------------------------------------------------------------------
// Signup risk scoring
// ---------------------------------------------------------------------------

export const RISK_FLAG_THRESHOLD = 30;
const REPEAT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface RiskResult {
  score: number;
  flags: string[];
  status: string; // "none" | "flagged"
}

// Scores a fresh signup. No hard blocks — anything above the threshold just
// sets riskStatus to "flagged" for admin review. The pattern rule from the
// design: a single mailbox-reuse void is a nothingburger, but a fresh sibling
// account from a device that already produced a mailbox-reuse void is a flag.
export async function computeSignupRisk(opts: {
  userId: string;
  email: string;
  fingerprint?: string | null;
  ip?: string | null;
}): Promise<RiskResult> {
  let score = 0;
  const flags: string[] = [];

  if (opts.fingerprint) {
    const blockedDevice = await prisma.blockedSignal.findUnique({
      where: { type_value: { type: "device", value: opts.fingerprint } },
    });
    if (blockedDevice) {
      score += 60;
      flags.push("blocked_device");
    }
  }
  if (opts.ip && opts.ip !== "unknown") {
    const blockedIp = await prisma.blockedSignal.findUnique({
      where: { type_value: { type: "ip", value: opts.ip } },
    });
    if (blockedIp) {
      score += 40;
      flags.push("blocked_ip");
    }
  }

  if (opts.fingerprint) {
    // A device that already produced a mailbox-reuse void is the tell: the
    // operator voided a trial, then immediately spun up a fresh account.
    const siblings = await prisma.user.findMany({
      where: { deviceFingerprint: opts.fingerprint, id: { not: opts.userId } },
      select: { trialVoided: true, trialVoidReason: true },
    });
    if (siblings.some((s) => s.trialVoided && s.trialVoidReason === "mailbox_reuse")) {
      score += 45;
      flags.push("void_plus_repeat");
    }

    const deviceRepeats = await prisma.signupSignal.count({
      where: {
        deviceFingerprint: opts.fingerprint,
        createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
      },
    });
    // First repeat (2 accounts) is tolerated — shared laptops. The burst
    // pattern (3+) is what earns points.
    if (deviceRepeats >= 2) {
      score += Math.min(deviceRepeats - 1, 3) * 15;
      flags.push("device_repeat");
    }
  }

  if (opts.ip && opts.ip !== "unknown") {
    const ipRepeats = await prisma.signupSignal.count({
      where: { ip: opts.ip, createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) } },
    });
    if (ipRepeats >= 2) {
      score += Math.min(ipRepeats - 1, 3) * 5;
      flags.push("ip_repeat");
    }
  }

  // Signing up with an email that is already a connected mailbox on another
  // profile is the same-person fingerprint at the account level.
  const signupMailbox = await prisma.mailboxIdentity.findFirst({
    where: {
      email: opts.email.trim().toLowerCase(),
      firstSeenUserId: { not: opts.userId },
    },
  });
  if (signupMailbox) {
    score += 35;
    flags.push("tied_mailbox_signup");
  }

  const status = score >= RISK_FLAG_THRESHOLD ? "flagged" : "none";
  return { score, flags, status };
}

// ---------------------------------------------------------------------------
// Admin kill
// ---------------------------------------------------------------------------

// Post-hoc enforcement: pauses everything, voids the trial, marks the account
// banned, and records the device/IP so future signups from it surface as high
// risk.
export async function killUser(userId: string, reason: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceFingerprint: true, signupIp: true },
  });

  await prisma.$transaction([
    prisma.campaign.updateMany({
      where: { userId, status: "active", deletedAt: null },
      data: { status: "paused" },
    }),
    prisma.emailAccount.updateMany({
      where: { userId, status: "active" },
      data: { status: "paused" },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { riskStatus: "banned", reviewedAt: new Date() },
    }),
  ]);

  await voidTrial(userId, reason);

  if (user?.deviceFingerprint) {
    await prisma.blockedSignal.upsert({
      where: { type_value: { type: "device", value: user.deviceFingerprint } },
      create: { type: "device", value: user.deviceFingerprint, reason: `kill:${userId}` },
      update: {},
    });
  }
  if (user?.signupIp) {
    await prisma.blockedSignal.upsert({
      where: { type_value: { type: "ip", value: user.signupIp } },
      create: { type: "ip", value: user.signupIp, reason: `kill:${userId}` },
      update: {},
    });
  }
}
