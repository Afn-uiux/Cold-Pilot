export type PlanId = "free" | "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  leadLimit: number;
  inboxLimit: number;
  creditsPerMonth: number;
  aiEnabled: boolean;
  verificationAllowance: number;
}

// Included credits are derived from the published verification allowance
// (1 verification = 0.25 credits). Starter's "1,000 verifications / month"
// is 250 credits, and so on.
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    leadLimit: 300,
    inboxLimit: 2,
    creditsPerMonth: 75,
    aiEnabled: false,
    verificationAllowance: 300,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 19,
    leadLimit: 5000,
    inboxLimit: Infinity,
    creditsPerMonth: 250,
    aiEnabled: true,
    verificationAllowance: 1000,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 49,
    leadLimit: 30000,
    inboxLimit: Infinity,
    creditsPerMonth: 1250,
    aiEnabled: true,
    verificationAllowance: 5000,
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 99,
    leadLimit: 150000,
    inboxLimit: Infinity,
    creditsPerMonth: 5000,
    aiEnabled: true,
    verificationAllowance: 20000,
  },
};

export const CREDIT_COSTS = {
  verification: 0.25,
  ai: 2,
} as const;

export interface CreditPack {
  credits: number;
  price: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { credits: 100, price: 5 },
  { credits: 500, price: 15 },
  { credits: 2000, price: 40 },
  { credits: 10000, price: 100 },
];

export function getPlan(planId: string | null | undefined): Plan {
  return PLANS[(planId as PlanId) ?? "free"] ?? PLANS.free;
}
