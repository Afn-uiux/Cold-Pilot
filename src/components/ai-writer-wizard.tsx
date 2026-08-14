"use client";

import { useState, useEffect } from "react";
import { VARIABLE_LIST, processSpintax } from "@/engine/personalize";
import { RefreshIcon } from "@/components/icons/refresh";
import { Cancel01Icon } from "@/components/icons/cancel-01";

export type GeneratedStep = { subject: string; body: string };

type Lead = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  personalization?: string | null;
  phone?: string | null;
  website?: string | null;
};

export default function AiWriterWizard({
  open,
  campaignId,
  onClose,
  onGenerated,
}: {
  open: boolean;
  campaignId: string;
  onClose: () => void;
  onGenerated: (steps: GeneratedStep[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [offerDetails, setOfferDetails] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [caseStudies, setCaseStudies] = useState("");
  const [stepCount, setStepCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedStep[] | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [leadList, setLeadList] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [varOverrides, setVarOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    fetch(`/api/leads?campaignId=${campaignId}`)
      .then(r => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) setLeadList(d as Lead[]);
      })
      .catch(() => {});
  }, [open, campaignId]);

  function selectLead(id: string) {
    setSelectedLeadId(id);
    const lead = leadList.find(l => l.id === id);
    setVarOverrides({
      firstName: lead?.firstName || "",
      lastName: lead?.lastName || "",
      companyName: lead?.company || "",
      personalization: lead?.personalization || "",
      phone: lead?.phone || "",
      website: lead?.website || "",
      accountSignature: "",
    });
  }

  if (!open) return null;

  function goTo(n: number) {
    setError("");
    setStep(n);
  }

  function canContinue() {
    if (step === 1) return companyName.trim().length > 0;
    if (step === 2) return offerDetails.trim().length > 0;
    if (step === 3) return targetAudience.trim().length > 0;
    if (step === 4) return caseStudies.trim().length > 0;
    return false;
  }

  function reset() {
    setStep(1);
    setCompanyName("");
    setOfferDetails("");
    setTargetAudience("");
    setCaseStudies("");
    setStepCount(3);
    setGenerating(false);
    setError("");
    setResult(null);
    setPreviewIdx(0);
    setSelectedLeadId("");
    setVarOverrides({});
  }

  async function generate() {
    setError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-sequence",
          companyName,
          offerDetails,
          targetAudience,
          caseStudies,
          stepCount,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "AI request failed. Please try again.");
        setGenerating(false);
        return;
      }
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        setResult(data.steps);
        setPreviewIdx(0);
        setGenerating(false);
      } else {
        setError("The AI couldn't generate a sequence. Please try again.");
        setGenerating(false);
      }
    } catch {
      setError("AI request failed. Please try again.");
      setGenerating(false);
    }
  }

  function fillVariables(text: string): string {
    const overriddenKeys = new Set(Object.keys(varOverrides).filter(k => varOverrides[k]));
    let result = text;
    for (const [key, val] of Object.entries(varOverrides)) {
      if (val) result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    const samples: Record<string, string> = {
      firstName: "John", lastName: "Doe", company: "Acme Inc",
      companyName: "Acme Inc", title: "CEO", email: "john@acme.com",
      phone: "(555) 123-4567", personalization: "loved your recent post",
      website: "acme.com", location: "San Francisco, CA", signature: "Best regards,\nYour Name",
      accountSignature: "Best regards,\nYour Name",
    };
    for (const [key, val] of Object.entries(samples)) {
      if (!overriddenKeys.has(key)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
      }
    }
    return processSpintax(result);
  }

  function htmlToPreview(body: string): string {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc(body).replace(/\r?\n/g, "<br>");
  }

  const inputCls =
    "w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-accent/40 focus:border-blue-accent text-ink bg-white placeholder:text-muted-2 text-sm";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="bg-cream border border-border rounded-2xl shadow-2xl w-full max-w-3xl p-8" onClick={e => e.stopPropagation()}>
        {!result && !generating && (
          <>
            <h1 className="text-2xl font-bold text-ink mb-1">Let&apos;s generate a new sequence</h1>

            {/* Step 1 — Company name */}
            {step === 1 && (
              <div className="mt-6">
                <p className="text-blue-accent font-medium mb-2">What is the name of your company?</p>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canContinue() && goTo(2)}
                  placeholder="Acme Inc."
                  autoFocus
                  className={inputCls}
                />
                <div className="flex items-center gap-4 mt-8">
                  <button onClick={onClose} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Cancel</button>
                  <button onClick={() => goTo(2)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 2 — Offer details */}
            {step === 2 && (
              <div className="mt-6">
                <p className="text-blue-accent font-medium mb-1">What are the details of your offer?</p>
                <p className="text-xs text-muted mb-2">Be as detailed as possible. 3-4 sentences.</p>
                <textarea
                  value={offerDetails}
                  onChange={e => setOfferDetails(e.target.value)}
                  rows={4}
                  placeholder="We help sales teams book more meetings with automated cold outreach."
                  className={`${inputCls} resize-none`}
                />
                <div className="flex items-center gap-4 mt-4">
                  <button onClick={() => goTo(1)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                  <button onClick={() => goTo(3)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 3 — Target audience */}
            {step === 3 && (
              <div className="mt-6">
                <p className="text-blue-accent font-medium mb-1">Who is your target audience?</p>
                <p className="text-xs text-muted mb-2">Provide 2-3 sentences of information.</p>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canContinue() && goTo(4)}
                  placeholder="Agencies and B2B companies"
                  className={inputCls}
                />
                <div className="flex items-center gap-4 mt-4">
                  <button onClick={() => goTo(2)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                  <button onClick={() => goTo(4)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 4 — Case studies */}
            {step === 4 && (
              <div className="mt-6">
                <p className="text-blue-accent font-medium mb-1">What are your case studies?</p>
                <p className="text-xs text-muted mb-2">Mention 1-2 case studies or an impressive result you could show a potential client.</p>
                <textarea
                  value={caseStudies}
                  onChange={e => setCaseStudies(e.target.value)}
                  rows={5}
                  placeholder="We helped a SaaS client grow from 200 to 2,000 signups in 4 months."
                  className={`${inputCls} resize-none`}
                />
                <div className="flex items-center gap-4 mt-4">
                  <button onClick={() => goTo(3)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                  <button onClick={() => goTo(5)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 5 — Step count */}
            {step === 5 && (
              <div className="mt-6">
                <p className="text-blue-accent font-medium mb-1">How many emails should the sequence include?</p>
                <p className="text-xs text-muted mb-2">The AI will write this many emails, from first touch to follow-ups.</p>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setStepCount(n)}
                      className={`px-4 py-2.5 border rounded-lg text-sm font-medium transition-all ${stepCount === n ? "border-blue-accent bg-blue-light text-blue-accent" : "border-border text-muted hover:bg-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={stepCount}
                    onChange={e => setStepCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-16 px-3 py-2.5 border border-border rounded-lg text-sm text-center text-ink focus:outline-none focus:border-blue-accent bg-white"
                  />
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <button onClick={() => goTo(4)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                  <button onClick={generate} className="btn btn-primary hover:bg-blue-accent-hover">Generate sequence</button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
          </>
        )}

        {generating && (
          <div className="text-center py-10">
            <div className="mx-auto mb-6 h-12 w-12 border-2 border-blue-accent border-t-transparent rounded-full animate-spin" />
            <h3 className="text-xl font-semibold text-ink">Generating your sequence…</h3>
            <p className="text-sm text-muted mt-2">The AI is writing your {stepCount}-email sequence based on your inputs.</p>
          </div>
        )}

        {result && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-bold text-ink">Your generated sequence</h1>
                <p className="text-xs text-muted mt-1">Preview each email with lead data, then use it or regenerate.</p>
              </div>
              <button onClick={onClose} className="text-muted-2 hover:text-blue-accent"><Cancel01Icon size={18} /></button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Left — step list */}
              <div className="w-full md:w-[240px] shrink-0 space-y-2">
                {result.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewIdx(i)}
                    className={`w-full text-left rounded-xl border p-3.5 transition-all ${previewIdx === i ? "border-blue-accent bg-blue-light/40" : "border-border bg-white hover:border-blue-accent/50"}`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-2 mb-1">
                      {i === 0 ? "Initial outreach" : `Follow-up ${i}`} · Step {i + 1}
                    </div>
                    <div className="text-sm font-medium text-ink line-clamp-2">{s.subject}</div>
                    <div className="text-xs text-muted-2 mt-1.5 line-clamp-2">{s.body.replace(/\r?\n/g, " ")}</div>
                  </button>
                ))}
              </div>

              {/* Right — preview with lead data */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row gap-5">
                  <div className="w-full md:w-[220px] shrink-0 space-y-4">
                    <div>
                      <label className="text-xs text-muted block mb-1.5 font-medium">Load data for lead:</label>
                      <select
                        value={selectedLeadId}
                        onChange={e => selectLead(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-blue-accent"
                      >
                        <option value="">Select a lead…</option>
                        {leadList.map(l => (
                          <option key={l.id} value={l.id}>{l.firstName || l.email} {l.lastName || ""}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-2 font-medium">Variables</label>
                      <div className="space-y-2.5">
                        {VARIABLE_LIST.map(v => (
                          <div key={v.key}>
                            <div className="text-[11px] text-muted-2 mb-0.5">{v.label}</div>
                            <input
                              value={varOverrides[v.key] ?? ""}
                              onChange={e => setVarOverrides(prev => ({ ...prev, [v.key]: e.target.value }))}
                              placeholder={v.tag}
                              className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-blue-accent placeholder:text-muted-2"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-2 uppercase tracking-wider mb-1.5 font-medium">
                      Email preview · Step {previewIdx + 1}
                    </div>
                    <div className="bg-[#f7f8fa] border border-gray-200 rounded-lg p-5 min-h-[260px] max-h-[380px] overflow-y-auto">
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Subject</div>
                      <div className="text-sm font-semibold text-ink mb-4 pb-3 border-b border-gray-200">
                        {fillVariables(result[previewIdx]?.subject || "") || "(no subject)"}
                      </div>
                      <div
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: htmlToPreview(fillVariables(result[previewIdx]?.body || "")) }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
              <button
                onClick={generate}
                disabled={generating}
                className="btn btn-ghost btn-sm flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshIcon size={14} />
                {generating ? "Generating…" : "Regenerate"}
              </button>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
                <button
                  onClick={() => { onGenerated(result); onClose(); reset(); }}
                  className="btn btn-primary hover:bg-blue-accent-hover btn-sm flex items-center gap-2"
                >
                  Use this sequence
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
