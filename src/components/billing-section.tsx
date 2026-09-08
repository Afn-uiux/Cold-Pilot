"use client";

import { useState, useEffect } from "react";
import { PLANS, CREDIT_PACKS, type PlanId } from "@/lib/plans";
import { formatPrice } from "@/lib/currency";

type BillingState = {
  plan: PlanId;
  creditBalance: number;
  aiEnabled: boolean;
  leadLimit: number;
  inboxLimit: number;
  payg: boolean;
  billingCurrency: "NGN" | "USD";
  billingEnabled: boolean;
} | null;

type Notice = { type: "success" | "cancelled" | "error"; text: string } | null;

export default function BillingSection() {
  const [state, setState] = useState<BillingState>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/user")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setState({
          plan: data.plan || "free",
          creditBalance: typeof data.creditBalance === "number" ? data.creditBalance : 0,
          aiEnabled: !!data.aiEnabled,
          leadLimit: typeof data.leadLimit === "number" ? data.leadLimit : 300,
          inboxLimit: typeof data.inboxLimit === "number" ? data.inboxLimit : 2,
          payg: !!data.payg,
          billingCurrency: data.billingCurrency === "USD" ? "USD" : "NGN",
          billingEnabled: data.billingEnabled !== false,
        });
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get("billing");
    if (billingStatus === "success" || billingStatus === "cancelled") {
      const msg =
        billingStatus === "success"
          ? { type: "success" as const, text: "Payment received. Your balance/plan has been updated." }
          : { type: "cancelled" as const, text: "Checkout was cancelled. No charge was made." };
      queueMicrotask(() => {
        if (active) setNotice(msg);
      });
    }

    return () => {
      active = false;
    };
  }, []);

  async function startCheckout(payload: { kind: "credits"; credits: number } | { kind: "plan"; plan: PlanId }) {
    setBusy(payload.kind === "credits" ? `credits-${payload.credits}` : `plan-${payload.plan}`);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        setNotice({ type: "error", text: data.error || "Could not start checkout. Please try again." });
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setNotice({ type: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

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
      {notice && (
        <div className={`card border ${notice.type === "success" ? "border-green-500" : notice.type === "cancelled" ? "border-amber-500" : "border-red-500"}`}>
          <p className="text-sm">{notice.text}</p>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>Current plan</h3></div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Plan</p>
            <p className="text-lg font-medium mt-1">{currentPlan.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Price</p>
            <p className="text-lg font-medium mt-1">{currentPlan.price === 0 ? "Free" : formatPrice(currentPlan.price, state.billingCurrency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Credit balance</p>
            <p className="text-lg font-medium mt-1">{Math.floor(state.creditBalance).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          <span className="badge active">AI {state.aiEnabled ? "included" : "not on this plan"}</span>
          <span className="badge active">{state.leadLimit === Infinity ? "Unlimited leads" : `${state.leadLimit.toLocaleString()} leads`}</span>
          <span className="badge active">{state.inboxLimit === Infinity ? "Unlimited inboxes" : `${state.inboxLimit} inboxes`}</span>
        </div>
        {state.payg && (
          <p className="text-xs text-muted mt-2">
            Pay-as-you-go — every action runs on credits. No subscription needed.
          </p>
        )}
      </div>

      {!state.billingEnabled && (
        <div className="card">
          <div className="card-header"><h3>Plans &amp; credits</h3></div>
          <p className="text-sm text-muted">Payments aren&apos;t available yet. You can keep using your free trial and current balance for now — check back soon.</p>
        </div>
      )}

      {state.billingEnabled && (<>
      <div className="card">
        <div className="card-header"><h3>Upgrade plan</h3></div>
        <p className="text-sm text-muted mb-4">Switch to a paid plan for more leads, inboxes and AI. Plans are a one-time payment right now (recurring billing returns soon).</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["starter", "pro", "agency"] as PlanId[]).map((id) => {
            const p = PLANS[id];
            const isCurrent = state.plan === id;
            return (
              <div key={id} className="border border-border rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.name}</p>
                  {isCurrent && <span className="badge active">Current</span>}
                </div>
                <p className="text-2xl font-medium mt-2">{formatPrice(p.price, state.billingCurrency)}<span className="text-xs text-muted font-normal"> one-time</span></p>
                <p className="text-xs text-muted mt-2">{p.leadLimit === Infinity ? "Unlimited" : p.leadLimit.toLocaleString()} leads</p>
                <p className="text-xs text-muted mt-1">{p.inboxLimit === Infinity ? "Unlimited inboxes" : `${p.inboxLimit} inboxes`}</p>
                <p className="text-xs text-muted mt-1">AI {p.aiEnabled ? "included" : "not included"}</p>
                <button
                  disabled={isCurrent || busy === `plan-${id}`}
                  onClick={() => startCheckout({ kind: "plan", plan: id })}
                  className="btn btn-ghost btn-sm mt-4 w-full"
                >
                  {isCurrent ? "Current plan" : busy === `plan-${id}` ? "Redirecting…" : id === "starter" ? "Upgrade" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Buy credits</h3></div>
        <p className="text-sm text-muted mb-4">Top up your balance — credits never expire.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.credits} className="border border-border rounded-lg p-5">
              <p className="text-2xl font-medium">{pack.credits.toLocaleString()}<span className="text-sm text-muted font-normal"> credits</span></p>
              <p className="text-sm text-muted mt-1">{formatPrice(pack.price, state.billingCurrency)}</p>
              <p className="text-[11px] text-muted-2 mt-1">{formatPrice(pack.price / pack.credits, state.billingCurrency)} / credit</p>
              <button
                disabled={busy !== null}
                onClick={() => startCheckout({ kind: "credits", credits: pack.credits })}
                className="btn btn-ghost btn-sm mt-4 w-full"
              >
                {busy === `credits-${pack.credits}` ? "Redirecting…" : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>
      </>)}

    </div>
  );
}
