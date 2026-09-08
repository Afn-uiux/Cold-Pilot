import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { getPlan, SIGNUP_CREDITS } from "./plans";
import { trialGrantsFeatureAccess } from "./trial";

// True for the unique-constraint violation Prisma raises when a
// creditTransaction with an already-used refId is inserted. We treat that as
// proof the charge already settled (idempotent retry), not as an error.
function isDuplicateRefId(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export class InsufficientCreditsError extends Error {
  balance: number;
  required: number;

  constructor(balance: number, required: number) {
    super(`Insufficient credits: ${balance} available, ${required} required`);
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.required = required;
  }
}

export class PlanLimitError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
  }
}

// Whether a free user currently has credits and is therefore operating as
// pay-as-you-go: full feature access, but every action is credit-metered.
// Purchased credits never expire, so this stays true after the trial window
// for as long as (and only while) their balance is positive.
export function isPayAsYouGo(plan?: string | null, creditBalance?: number | null): boolean {
  return plan === "free" && Number(creditBalance ?? 0) > 0;
}

// Grants the one-time signup bonus (SIGNUP_CREDITS) the first time the user's
// balance is touched — but only after their email is verified. Free signup
// credits are a paid-adjacent asset, so granting them to an unverified address
// lets an attacker mint credits with a throwaway/fake inbox. Paid credits via
// addCredits are a separate path and are not gated here.
export async function ensureSignupCredits(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupCreditsGranted: true, emailVerified: true },
  });
  if (!user || user.signupCreditsGranted) return;
  if (!user.emailVerified) return; // wait for email verification before granting

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        creditBalance: { increment: SIGNUP_CREDITS },
        freeCreditReserve: { increment: SIGNUP_CREDITS },
        signupCreditsGranted: true,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: SIGNUP_CREDITS,
        reason: "signup_bonus",
      },
    }),
  ]);
}

export interface CreditState {
  plan: string;
  planName: string;
  balance: number;
  leadLimit: number;
  inboxLimit: number;
  aiEnabled: boolean;
  payg: boolean;
  trialActive: boolean;
}

export async function getCreditState(userId: string): Promise<CreditState | null> {
  await ensureSignupCredits(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, trialEndsAt: true, trialVoided: true, creditBalance: true },
  });
  if (!user) return null;
  const plan = getPlan(user.plan);
  const freeTrialActive =
    user.plan === "free" &&
    trialGrantsFeatureAccess(user.plan, user.trialEndsAt, user.trialVoided ?? false);
  const payg = isPayAsYouGo(user.plan, user.creditBalance) && !freeTrialActive;
  return {
    plan: plan.id,
    planName: plan.name,
    balance: user.creditBalance,
    // Hard caps: free (incl. trial) and all paid plans enforce plan.leadLimit.
    // Pay-as-you-go is intentionally unlimited on leads — the credit cost of
    // importing/verifying is the throttle (assertLeadCapacity skips PAYG).
    leadLimit: payg ? Infinity : plan.leadLimit,
    inboxLimit: plan.inboxLimit,
    aiEnabled: plan.aiEnabled || freeTrialActive || payg,
    payg,
    trialActive: freeTrialActive,
  };
}

// Atomically deducts credits. Throws InsufficientCreditsError when the user
// doesn't have enough, leaving the balance untouched.
// When a `refId` idempotency key is supplied and a credit transaction with that
// key already exists, this is a retry of a settled charge and is a no-op.
export async function spendCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  await ensureSignupCredits(userId);

  // A spend must be strictly positive. A zero charge is a no-op that would only
  // litter the ledger; a NEGATIVE "spend" would flip the decrement into an
  // increment and mint credits for free — refuse both.
  if (!Number.isFinite(amount) || amount <= 0) return;

  // Fast path: an already-recorded refId means this exact charge settled
  // earlier, so there is nothing to do. Callers that need strong idempotency
  // under concurrent delivery (e.g. payment webhooks) deduplicate before
  // calling in, so this is a best-effort short-circuit, not the only guard.
  if (refId) {
    const existing = await prisma.creditTransaction.findFirst({ where: { refId } });
    if (existing) return;
  }

  try {
    // Decrement and ledger-write in ONE transaction so they cannot diverge.
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, creditBalance: { gte: amount } },
        data: { creditBalance: { decrement: amount } },
      });

      if (result.count === 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { creditBalance: true },
        });
        throw new InsufficientCreditsError(user?.creditBalance ?? 0, amount);
      }

      // Spend the free/signup reserve first so purchased credits last as long
      // as possible. The reserve can't go negative: we clamp to what's left.
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { freeCreditReserve: true },
      });
      const takeFromReserve = Math.min(user?.freeCreditReserve ?? 0, amount);
      if (takeFromReserve > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { freeCreditReserve: { decrement: takeFromReserve } },
        });
      }

      await tx.creditTransaction.create({
        data: { userId, amount: -amount, reason, refId },
      });
    });
  } catch (err) {
    // Concurrent duplicate of an already-settled charge: the transaction rolled
    // back (no double debit), so this is the same idempotent no-op as the fast
    // path above.
    if (refId && isDuplicateRefId(err)) return;
    throw err;
  }
}

// Adds credits (purchases, refunds, manual grants).
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;

  if (refId) {
    const existing = await prisma.creditTransaction.findFirst({ where: { refId } });
    if (existing) return;
  }

  try {
    // Increment and ledger-write in ONE transaction so they cannot diverge.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
      });
      await tx.creditTransaction.create({
        data: { userId, amount, reason, refId },
      });
    });
  } catch (err) {
    if (refId && isDuplicateRefId(err)) return;
    throw err;
  }
}

// Resumes every campaign that was auto-paused for lack of credits. Called right
// after a successful credit purchase (and plan grant) so paused campaigns pick
// up exactly where they left off — no manual re-start, no lost follow-ups.
// Returns how many campaigns were resumed.
export async function resumeCampaignsAfterCredits(userId: string): Promise<number> {
  const result = await prisma.campaign.updateMany({
    where: { userId, status: "paused", resumeOnFunding: true },
    data: { status: "active", resumeOnFunding: false },
  });
  return result.count;
}

// Enforces the plan's active-lead cap. Throws PlanLimitError when importing
// `incomingCount` would push the user over their limit.
export async function assertLeadCapacity(
  userId: string,
  incomingCount: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, creditBalance: true },
  });

  // Pay-as-you-go users have no hard lead cap — the credit cost of importing is
  // the throttle, exactly like the send path. Enforce the plan cap only for
  // free/trial users who cannot pay per lead.
  if (isPayAsYouGo(user?.plan, user?.creditBalance)) return;

  const plan = getPlan(user?.plan);

  // Counts every lead ever created, including deleted ones. Deleting leads is
  // data cleanup, not a limit reset — capacity is consumed permanently.
  const current = await prisma.lead.count({
    where: { userId },
  });

  if (current + incomingCount > plan.leadLimit) {
    throw new PlanLimitError(
      `Lead limit reached. ${plan.name} allows ${plan.leadLimit} total leads; you've used ${current} (deleted leads still count). Upgrade to add ${incomingCount} more.`,
      "LEAD_LIMIT"
    );
  }
}

// Enforces the plan's inbox cap. Throws PlanLimitError when the user already
// has their allowance of connected inboxes.
export async function assertInboxCapacity(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  const plan = getPlan(user?.plan);

  const count = await prisma.emailAccount.count({ where: { userId } });
  if (count >= plan.inboxLimit) {
    const label =
      plan.inboxLimit === 1 ? "1 connected inbox" : plan.inboxLimit === 2 ? "2 connected inboxes" : "unlimited inboxes";
    throw new PlanLimitError(
      `${plan.name} includes ${label}. Upgrade to connect more.`,
      "INBOX_LIMIT"
    );
  }
}
