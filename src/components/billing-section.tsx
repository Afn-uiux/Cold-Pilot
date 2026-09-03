"use client";

import { useState, useEffect } from "react";
import { PLANS, CREDIT_PACKS, type PlanId } from "@/lib/plans";
import { formatPrice } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-client";

type BillingState = {
  plan: PlanId;
  creditBalance: number;
  aiEnabled: boolean;
  billingCurrency: "NGN" | "USD";
} | null;

type Notice = { type: "success" | "cancelled" | "error"; text: string } | null;

export default function BillingSection() {
  const [state, setState] = useState<BillingState>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const currency = useCurrency();

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
          billingCurrency: data.billingCurrency === "USD" ? "USD" : "NGN",
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

  async function setBillingCurrency(next: "NGN" | "USD") {
    setBusy(`currency-${next}`);
    setNotice(null);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingCurrency: next }),
      });
      if (!res.ok) {
        setNotice({ type: "error", text: "Could not update billing currency. Please try again." });
        setBusy(null);
        return;
      }
      window.location.reload();
    } catch {
      setNotice({ type: "error", text: "Network error. Please try again." });
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
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <h3>Upgrade plan</h3>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              disabled={busy !== null}
              onClick={() => setBillingCurrency("NGN")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                state.billingCurrency === "NGN" ? "bg-blue-accent text-white" : "text-muted hover:text-ink"
              }`}
            >
              ₦ Naira
            </button>
            <button
              disabled={busy !== null}
              onClick={() => setBillingCurrency("USD")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                state.billingCurrency === "USD" ? "bg-blue-accent text-white" : "text-muted hover:text-ink"
              }`}
            >
              $ Dollar
            </button>
          </div>
        </div>
        <p className="text-sm text-muted mb-4">Switch to a paid plan for more leads, inboxes and AI. Your card is saved and billed {state.billingCurrency === "NGN" ? "in Naira" : "in Dollars"} monthly.</p>
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
                <p className="text-2xl font-medium mt-2">{formatPrice(p.price, currency)}<span className="text-xs text-muted font-normal">/mo</span></p>
                <p className="text-xs text-muted mt-2">{p.leadLimit === Infinity ? "Unlimited" : p.leadLimit.toLocaleString()} leads</p>
                <p className="text-xs text-muted mt-1">{p.inboxLimit === Infinity ? "Unlimited" : `${p.inboxLimit} inboxes`}</p>
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
              <p className="text-sm text-muted mt-1">{formatPrice(pack.price, currency)}</p>
              <p className="text-[11px] text-muted-2 mt-1">{formatPrice(pack.price / pack.credits, currency)} / credit</p>
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
    </div>
  );
}
