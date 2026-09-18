import { prisma } from "./prisma";
import { NextResponse } from "next/server";

export const TRIAL_DAYS = 14;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export class TrialExpiredError extends Error {
  code = "TRIAL_EXPIRED";
  daysLeft = 0;

  constructor(daysLeft = 0) {
    super("Your 14-day trial has ended. Upgrade to keep using ColdPilot.");
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

// Whether a free user inside their trial window gets features that are
// otherwise paid-only (AI). Mirrors isEntitledToWarmup: paid plans are always
// entitled; free users only while the trial has not ended and has not been
// voided. Legacy free accounts (no trial clock) never get paid features.
export function trialGrantsFeatureAccess(
  plan: string | null | undefined,
  trialEndsAt: Date | null,
  trialVoided = false
): boolean {
  if (plan && plan !== "free") return true;
  if (trialVoided) return false;
  return !!trialEndsAt && trialEndsAt.getTime() > Date.now();
}

// When trial expires, revoke ONLY the free/signup portion of the user's credit
// balance. Purchased credits never expire — they are the user's pay-as-you-go
// fuel and must survive the trial for them to keep using the product.
export async function expireTrialCredits(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, freeCreditReserve: true },
  });
  if (!user || user.plan !== "free" || user.freeCreditReserve <= 0) return;

  await prisma.$transaction([
    prisma.creditTransaction.create({
      data: { userId, amount: -user.freeCreditReserve, reason: "trial_expired" },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: user.freeCreditReserve }, freeCreditReserve: 0 },
    }),
  ]);
}

// Throws TrialExpiredError when the user's free trial has ended — UNLESS the
// user still has a positive balance (pay-as-you-go). Credits gate new
// consumption, never access to what the user already has: a user who paid for
// credits keeps full access for as long as the balance lasts, and a user at
// zero balance is still never locked out of reading their own data (reads are
// not gated by this function). Call this in every action endpoint to enforce
// the paywall. Returns the trial status for callers that need it.
export async function assertTrialActive(userId: string): Promise<TrialStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, trialEndsAt: true, trialVoided: true, creditBalance: true, freeCreditReserve: true },
  });

  const status = getTrialStatus(user?.plan ?? "free", user?.trialEndsAt ?? null, user?.trialVoided ?? false);
  if (status.expired) {
    // Revoke any leftover free credits on first detection, but keep purchases.
    await expireTrialCredits(userId);
    // Re-read: still positive balance after the free reserve is gone => the
    // user has bought credits and continues as pay-as-you-go.
    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    if (Number(after?.creditBalance ?? 0) > 0) {
      status.active = true;
      status.expired = false;
      status.daysLeft = Infinity;
      return status;
    }
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
