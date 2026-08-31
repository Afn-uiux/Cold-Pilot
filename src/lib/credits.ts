import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { getPlan, SIGNUP_CREDITS } from "./plans";

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
}

export async function getCreditState(userId: string): Promise<CreditState | null> {
  await ensureSignupCredits(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, creditBalance: true },
  });
  if (!user) return null;
  const plan = getPlan(user.plan);
  return {
    plan: plan.id,
    planName: plan.name,
    balance: user.creditBalance,
    leadLimit: plan.leadLimit,
    inboxLimit: plan.inboxLimit,
    aiEnabled: plan.aiEnabled,
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
  // earlier, so there is nothing to do. (The transaction below is what actually
  // makes concurrent duplicates safe — this just avoids opening one needlessly.)
  if (refId) {
    const existing = await prisma.creditTransaction.findUnique({ where: { refId } });
    if (existing) return;
  }

  try {
    // Decrement and ledger-write in ONE transaction so they cannot diverge. If
    // two requests race with the same refId, both may pass the check above, but
    // only one create() can win the unique(refId) constraint — the loser throws
    // P2002 and its whole transaction (including the decrement) rolls back, so
    // the balance is debited exactly once.
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
    const existing = await prisma.creditTransaction.findUnique({ where: { refId } });
    if (existing) return;
  }

  try {
    // Same atomic + idempotent shape as spendCredits: increment and ledger-write
    // together, and let the unique(refId) constraint collapse a duplicate grant
    // (e.g. a retried payment webhook) into a single credit.
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

// Enforces the plan's active-lead cap. Throws PlanLimitError when importing
// `incomingCount` would push the user over their limit.
export async function assertLeadCapacity(
  userId: string,
  incomingCount: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
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
