import { prisma } from "./prisma";
import { NextResponse } from "next/server";

export const TRIAL_DAYS = 14;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export class TrialExpiredError extends Error {
  code = "TRIAL_EXPIRED";
  daysLeft = 0;

  constructor(daysLeft = 0) {
    super("Your 14-day trial has ended. Upgrade to keep using Coldpilot.");
    this.name = "TrialExpiredError";
    this.daysLeft = daysLeft;
  }
}

export interface TrialStatus {
  active: boolean;
  expired: boolean;
  daysLeft: number;
  endsAt: Date | null;
}

// Free accounts with a trialEndsAt are on the 14-day clock. Legacy free
// accounts (trialEndsAt null, created before the trial shipped) are exempt and
// stay free forever. Paid accounts are never locked. A voided trial (trial
// abuse detection) is always expired, regardless of plan/date.
export function getTrialStatus(plan: string, trialEndsAt: Date | null, trialVoided = false): TrialStatus {
  if (trialVoided) {
    return { active: false, expired: true, daysLeft: 0, endsAt: trialEndsAt };
  }
  if (plan !== "free" || !trialEndsAt) {
    return { active: true, expired: false, daysLeft: Infinity, endsAt: trialEndsAt };
  }
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)));
  return {
    active: now < trialEndsAt.getTime(),
    expired: now >= trialEndsAt.getTime(),
    daysLeft,
    endsAt: trialEndsAt,
  };
}

// When trial expires, zero out remaining credits so the user can't keep using
// them as free pay-as-you-go after the trial window.
export async function expireTrialCredits(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, creditBalance: true },
  });
  if (!user || user.plan !== "free" || user.creditBalance <= 0) return;

  await prisma.$transaction([
    prisma.creditTransaction.create({
      data: { userId, amount: -user.creditBalance, reason: "trial_expired" },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: 0 },
    }),
  ]);
}

// Throws TrialExpiredError when the user's free trial has ended. Call this in
// every action endpoint to enforce the paywall. Returns the trial status for
// callers that need it (e.g. to show a countdown).
export async function assertTrialActive(userId: string): Promise<TrialStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, trialEndsAt: true, trialVoided: true },
  });

  const status = getTrialStatus(user?.plan ?? "free", user?.trialEndsAt ?? null, user?.trialVoided ?? false);
  if (status.expired) {
    // Expire any leftover credits on first detection
    await expireTrialCredits(userId);
    throw new TrialExpiredError(status.daysLeft);
  }
  return status;
}

// Convenience for API routes: returns a 402 response when the trial has ended,
// or null when the user can proceed. Call right after auth().
export async function trialGuard(userId: string): Promise<NextResponse | null> {
  try {
    await assertTrialActive(userId);
    return null;
  } catch (err) {
    if (err instanceof TrialExpiredError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "TRIAL_EXPIRED",
          upgradeUrl: "/dashboard/settings?tab=Billing",
        },
        { status: 402 }
      );
    }
    throw err;
  }
}

// Like trialGuard but allows GET requests through when trial is expired.
// Used on routes where the dashboard needs to read data (campaigns list,
// leads list, settings) but should block writes (create/update/delete).
export async function trialGuardAllowReads(
  userId: string,
  method?: string
): Promise<NextResponse | null> {
  if (method === "GET") return null;
  return trialGuard(userId);
}
