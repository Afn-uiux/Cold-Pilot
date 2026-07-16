"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = { type: "email" | "wait"; subject?: string; body?: string; delayDays?: number };
type Status = "idle" | "saving" | "error" | "success";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ type: "email", subject: "", body: "", delayDays: 1 }]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; email: string; provider: string }[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [deliveryOptimization, setDeliveryOptimization] = useState(false);
  const [openTracking, setOpenTracking] = useState(true);
  const [linkTracking, setLinkTracking] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-accounts")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAccounts(data);
          setSelectedAccountIds(data.filter((a: any) => a.status === "active").map((a: any) => a.id));
        }
      })
      .catch(() => {});
  }, []);

  function toggleAccount(id: string) {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg("Campaign name is required"); return; }
    if (steps.filter(s => s.type === "email").length === 0) { setErrorMsg("Add at least one email step"); return; }
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          steps: steps.filter(s => s.type === "email"),
          openTracking,
          clickTracking: linkTracking,
          dailySendLimit: dailyLimit ? parseInt(dailyLimit) : undefined,
          stopOnReply,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStatus("success");
      setTimeout(() => router.push("/dashboard/campaigns"), 800);
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong saving your campaign");
    }
  }

  function addStep(type: Step["type"]) {
    if (type === "email") setSteps([...steps, { type: "email", subject: "", body: "", delayDays: 1 }]);
    else setSteps([...steps, { type: "wait", delayDays: 3 }]);
  }

  function updateStep(i: number, field: string, value: any) {
    setSteps(prev => prev.map((s, j) => j === i ? { ...s, [field]: value } : s));
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, j) => j !== i));
  }

  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps(prev => prev.map((s, k) => k === i ? prev[j] : k === j ? prev[i] : s));
  }

  return (
    <div className="px-6 lg:px-10 pt-8 pb-16 max-w-3xl">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all">
          {toast}
        </div>
      )}
      <div className="mb-8">
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">New Campaign</h1>
        <p className="text-sm text-muted mt-1.5">Build your email sequence</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setStatus("idle")} className="text-red-400 hover:text-red-600">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3L11 11"/><path d="M11 3L3 11"/></svg>
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 4L6 12L3 9"/></svg>
            Campaign saved! Redirecting...
          </div>
        )}

        {/* Campaign Name */}
        <div className="card">
          <label className="block text-xs text-muted font-medium uppercase tracking-wide mb-2">Campaign Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required disabled={status === "saving" || status === "success"}
            className="w-full bg-transparent border-b border-border pb-2.5 text-base outline-none focus:border-blue-accent transition-colors disabled:opacity-50"
            placeholder="e.g. Q3 Outreach - Tech CEOs" />
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Sequence</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => addStep("email")} disabled={status === "saving" || status === "success"}
                className="btn btn-ghost btn-sm">+ Email</button>
              <button type="button" onClick={() => addStep("wait")} disabled={status === "saving" || status === "success"}
                className="btn btn-ghost btn-sm">+ Wait</button>
            </div>
          </div>

          {steps.map((step, i) => (
            <div key={i} className="card">
              <div className="card-header">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                      className="text-[10px] text-muted-2 hover:text-blue-accent disabled:opacity-20">▲</button>
                    <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                      className="text-[10px] text-muted-2 hover:text-blue-accent disabled:opacity-20">▼</button>
                  </div>
                  <span className="text-xs text-muted-2 font-medium uppercase">Step {i + 1}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${step.type === "email" ? "bg-blue-light text-blue-accent" : "bg-yellow-50 text-yellow-700"}`}>{step.type}</span>
                </div>
                {i > 0 && steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)} disabled={status === "saving"}
                    className="text-xs text-muted hover:text-red-600">Remove</button>
                )}
              </div>
              <div className="space-y-4">
                {step.type === "email" && (
                  <>
                    <div>
                      <label className="block text-xs text-muted mb-1.5">Subject Line</label>
                      <input value={step.subject || ""} onChange={e => updateStep(i, "subject", e.target.value)} disabled={status === "saving" || status === "success"}
                        placeholder="Enter subject line..." className="w-full bg-transparent border-b border-border pb-2 text-sm outline-none focus:border-blue-accent disabled:opacity-50" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-muted">Email Body</label>
                        <div className="flex gap-1">
                          {["firstName", "company", "title"].map(v => (
                            <button key={v} type="button" onClick={() => { navigator.clipboard.writeText(`{{${v}}}`).then(() => { setToast("Copied " + `{{${v}}}`); setTimeout(() => setToast(null), 2000); }); }}
                              className="text-xs text-muted-2 hover:text-blue-accent border border-border rounded px-1.5 py-0.5">{`{{${v}}}`}</button>
                          ))}
                        </div>
                      </div>
                      <textarea value={step.body || ""} onChange={e => updateStep(i, "body", e.target.value)} disabled={status === "saving" || status === "success"}
                        rows={6} className="w-full bg-transparent border border-border rounded-lg p-3 text-sm outline-none focus:border-blue-accent resize-y disabled:opacity-50"
                        placeholder={`Hi {{firstName}},\n\nI came across {{company}} and...`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted">Wait</label>
                      <input type="number" min={0} value={step.delayDays ?? 1} onChange={e => updateStep(i, "delayDays", parseInt(e.target.value) || 0)}
                        className="w-16 bg-transparent border border-border rounded px-2 py-1.5 text-sm text-center" />
                      <label className="text-xs text-muted">days before this step</label>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span>Reply detection active — sequence stops automatically when a lead responds</span>
                    </div>
                  </>
                )}
                {step.type === "wait" && (
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-2"><circle cx="8" cy="8" r="6"/><path d="M8 4V8L11 10"/></svg>
                    <span className="text-sm text-muted">Wait</span>
                    <input type="number" min={1} value={step.delayDays ?? 3} onChange={e => updateStep(i, "delayDays", parseInt(e.target.value) || 3)}
                      className="w-16 bg-transparent border border-border rounded px-2 py-1.5 text-sm text-center" />
                    <span className="text-sm text-muted">days</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Advanced Options */}
        <div className="card">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-sm font-medium">
            <span>Advanced Options</span>
            <svg className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showAdvanced && (
            <div className="border-t border-border mt-4 pt-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delivery Optimization</p>
                  <p className="text-xs text-muted mt-0.5">Disables open tracking for better deliverability</p>
                </div>
                <Toggle checked={deliveryOptimization} onChange={() => {
                  setDeliveryOptimization(!deliveryOptimization);
                  setOpenTracking(deliveryOptimization);
                }} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Open Tracking</p>
                  <p className="text-xs text-muted mt-0.5">Track when leads open your emails</p>
                </div>
                <Toggle checked={openTracking} onChange={() => setOpenTracking(!openTracking)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Link Tracking</p>
                  <p className="text-xs text-muted mt-0.5">Track link clicks in your emails</p>
                </div>
                <Toggle checked={linkTracking} onChange={() => setLinkTracking(!linkTracking)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stop sending on reply</p>
                  <p className="text-xs text-muted mt-0.5">Stop sending to a lead if they've responded</p>
                </div>
                <Toggle checked={stopOnReply} onChange={() => setStopOnReply(!stopOnReply)} />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Daily Limit</label>
                <p className="text-xs text-muted mb-2">Max number of emails to send per day for this campaign</p>
                <input type="number" min={0} value={dailyLimit} onChange={e => setDailyLimit(e.target.value)}
                  placeholder="No daily limit set"
                  className="w-full bg-transparent border-b border-border pb-2 text-sm outline-none focus:border-blue-accent" />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Accounts to use</label>
                <p className="text-xs text-muted mb-2">Select which connected accounts to send from</p>
                {accounts.length === 0 ? (
                  <div className="bg-cream-2 border border-border rounded-lg p-4 text-center">
                    <p className="text-xs text-muted mb-2">No accounts connected. Please connect an email account first.</p>
                    <button type="button" onClick={() => router.push("/dashboard/email-accounts")}
                      className="text-xs font-medium text-blue-accent hover:underline">Connect Account</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.map(acc => (
                      <label key={acc.id} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={selectedAccountIds.includes(acc.id)} onChange={() => toggleAccount(acc.id)}
                          className="w-4 h-4 rounded border-border text-blue-accent focus:ring-blue-accent" />
                        <div>
                          <p className="text-sm">{acc.email}</p>
                          <p className="text-xs text-muted">{acc.provider}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={status === "saving" || status === "success" || !name.trim()}
          className="btn btn-primary w-full flex items-center justify-center gap-2">
          {status === "saving" && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
          {status === "saving" ? "Saving..." : status === "success" ? "Saved!" : "Save Campaign"}
        </button>
      </form>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-blue-accent" : "bg-border"}`}>
      <span className={`absolute block w-4 h-4 bg-white rounded-full top-1 transition-all ${checked ? "left-5" : "left-1"}`} />
    </button>
  );
}
