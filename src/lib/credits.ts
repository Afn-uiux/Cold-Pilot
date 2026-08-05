import { prisma } from "./prisma";
import { getPlan, SIGNUP_CREDITS } from "./plans";

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
// balance is touched. Credits are only ever obtained again by purchasing packs.
export async function ensureSignupCredits(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupCreditsGranted: true },
  });
  if (!user || user.signupCreditsGranted) return;

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
export async function spendCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  await ensureSignupCredits(userId);

  const result = await prisma.user.updateMany({
    where: { id: userId, creditBalance: { gte: amount } },
    data: { creditBalance: { decrement: amount } },
  });

  if (result.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    throw new InsufficientCreditsError(user?.creditBalance ?? 0, amount);
  }

  await prisma.creditTransaction.create({
    data: { userId, amount: -amount, reason, refId },
  });
}

// Adds credits (purchases, refunds, manual grants).
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: amount } },
  });
  await prisma.creditTransaction.create({
    data: { userId, amount, reason, refId },
  });
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
