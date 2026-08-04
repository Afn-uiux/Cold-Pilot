import { prisma } from "./prisma";
import { getPlan } from "./plans";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

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

// Grants the user's monthly included credits once per billing cycle. Called
// before any spend so the balance is always current.
export async function ensureMonthlyCredits(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, creditCycleStart: true },
  });
  if (!user) return;

  const plan = getPlan(user.plan);
  const now = new Date();
  const needsGrant =
    !user.creditCycleStart ||
    now.getTime() - user.creditCycleStart.getTime() >= MONTH_MS;

  if (!needsGrant) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        creditBalance: { increment: plan.creditsPerMonth },
        creditCycleStart: now,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: plan.creditsPerMonth,
        reason: "monthly_included",
        refId: plan.id,
      },
    }),
  ]);
}

export interface CreditState {
  plan: string;
  planName: string;
  balance: number;
  creditsPerMonth: number;
  leadLimit: number;
  inboxLimit: number;
  aiEnabled: boolean;
}

export async function getCreditState(userId: string): Promise<CreditState | null> {
  await ensureMonthlyCredits(userId);
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
    creditsPerMonth: plan.creditsPerMonth,
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
  await ensureMonthlyCredits(userId);

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

  const current = await prisma.lead.count({
    where: { userId, deletedAt: null },
  });

  if (current + incomingCount > plan.leadLimit) {
    throw new PlanLimitError(
      `Lead limit reached. ${plan.name} allows ${plan.leadLimit} active leads; you have ${current}. Delete leads or upgrade to add ${incomingCount} more.`,
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
