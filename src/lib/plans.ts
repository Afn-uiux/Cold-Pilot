export type PlanId = "free" | "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  leadLimit: number;
  inboxLimit: number;
  aiEnabled: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    leadLimit: 300,
    inboxLimit: 2,
    aiEnabled: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 28500,
    leadLimit: 5000,
    inboxLimit: Infinity,
    aiEnabled: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 73500,
    leadLimit: 30000,
    inboxLimit: Infinity,
    aiEnabled: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 148500,
    leadLimit: 150000,
    inboxLimit: Infinity,
    aiEnabled: true,
  },
};

// One-time credits granted to every account on signup.
export const SIGNUP_CREDITS = 1000;

export const CREDIT_COSTS = {
  campaign: 1,
  verification: 0.25,
  ai: 2,
  leadImport: 0.1,
} as const;

export interface CreditPack {
  credits: number;
  price: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { credits: 100, price: 7500 },
  { credits: 500, price: 22500 },
  { credits: 2000, price: 60000 },
  { credits: 10000, price: 150000 },
];

export function getPlan(planId: string | null | undefined): Plan {
  return PLANS[(planId as PlanId) ?? "free"] ?? PLANS.free;
}
