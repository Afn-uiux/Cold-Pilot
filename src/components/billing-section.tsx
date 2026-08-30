"use client";

import { useState, useEffect } from "react";
import { PLANS, CREDIT_PACKS, type PlanId } from "@/lib/plans";
import { formatPrice } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-client";

export default function BillingSection() {
  const [state, setState] = useState<{ plan: PlanId; creditBalance: number; aiEnabled: boolean } | null>(null);
  const currency = useCurrency();

  useEffect(() => {
    let active = true;
    fetch("/api/user")
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setState({
          plan: data.plan || "free",
          creditBalance: typeof data.creditBalance === "number" ? data.creditBalance : 0,
          aiEnabled: !!data.aiEnabled,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!state) {
    return (
      <div className="card">
        <div className="card-header"><h3>Billing</h3></div>
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const currentPlan = PLANS[state.plan] || PLANS.free;

  return (
    <div className="space-y-8">
      <div className="card">
        <div className="card-header"><h3>Current plan</h3></div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Plan</p>
            <p className="text-lg font-medium mt-1">{currentPlan.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Price</p>
            <p className="text-lg font-medium mt-1">{currentPlan.price === 0 ? "Free" : `${formatPrice(currentPlan.price, currency)}/mo`}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Credit balance</p>
            <p className="text-lg font-medium mt-1">{Math.floor(state.creditBalance).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          <span className="badge active">AI {state.aiEnabled ? "included" : "not on this plan"}</span>
          <span className="badge active">{currentPlan.leadLimit === Infinity ? "Unlimited leads" : `${currentPlan.leadLimit.toLocaleString()} leads`}</span>
          <span className="badge active">{currentPlan.inboxLimit === Infinity ? "Unlimited inboxes" : `${currentPlan.inboxLimit} inboxes`}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Upgrade plan</h3></div>
        <p className="text-sm text-muted mb-4">Billing isn&apos;t wired up yet. Once payments are connected you&apos;ll switch plans here.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["starter", "pro", "agency"] as PlanId[]).map(id => {
            const p = PLANS[id];
            const isCurrent = state.plan === id;
            return (
              <div key={id} className="border border-border rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.name}</p>
                  {isCurrent && <span className="badge active">Current</span>}
                </div>
                <p className="text-2xl font-medium mt-2">{formatPrice(p.price, currency)}<span className="text-xs text-muted font-normal">/mo</span></p>
                <p className="text-xs text-muted mt-2">{p.leadLimit === Infinity ? "Unlimited" : p.leadLimit.toLocaleString()} leads</p>
                <p className="text-xs text-muted mt-1">{p.inboxLimit === Infinity ? "Unlimited" : `${p.inboxLimit} inboxes`}</p>
                <p className="text-xs text-muted mt-1">AI {p.aiEnabled ? "included" : "not included"}</p>
                <button disabled className="btn btn-ghost btn-sm mt-4 w-full" title="Coming soon">
                  {isCurrent ? "Current plan" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Buy credits</h3></div>
        <p className="text-sm text-muted mb-4">Top up your balance — credits never expire. Payment isn&apos;t connected yet.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {CREDIT_PACKS.map(pack => (
            <div key={pack.credits} className="border border-border rounded-lg p-5">
              <p className="text-2xl font-medium">{pack.credits.toLocaleString()}<span className="text-sm text-muted font-normal"> credits</span></p>
              <p className="text-sm text-muted mt-1">{formatPrice(pack.price, currency)}</p>
              <p className="text-[11px] text-muted-2 mt-1">{formatPrice(pack.price / pack.credits, currency)} / credit</p>
              <button disabled className="btn btn-ghost btn-sm mt-4 w-full" title="Coming soon">
                Buy
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
