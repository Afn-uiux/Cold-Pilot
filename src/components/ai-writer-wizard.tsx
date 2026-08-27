"use client";

import { useState, useEffect } from "react";
import { processSpintax } from "@/engine/personalize";
import { RefreshIcon } from "@/components/icons/refresh";
import { Cancel01Icon } from "@/components/icons/cancel-01";

export type GeneratedStep = { subject: string; body: string };

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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
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
      setCopiedIdx(null);
    }
  }, [open]);

  if (!open) return null;

  function canContinue() {
    if (step === 1) return companyName.trim().length > 0;
    if (step === 2) return offerDetails.trim().length > 0;
    if (step === 3) return targetAudience.trim().length > 0;
    if (step === 4) return caseStudies.trim().length > 0;
    return false;
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
    const samples: Record<string, string> = {
      firstName: "John", lastName: "Doe", company: "Acme Inc",
      companyName: "Acme Inc", title: "CEO", email: "john@acme.com",
      phone: "(555) 123-4567", personalization: "loved your recent post",
      website: "acme.com", location: "San Francisco, CA", signature: "Best regards,\nYour Name",
      accountSignature: "Best regards,\nYour Name",
    };
    let r = text;
    for (const [key, val] of Object.entries(samples)) {
      r = r.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    return processSpintax(r);
  }

  function htmlToPreview(body: string): string {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc(body).replace(/\r?\n/g, "<br>");
  }

  function copyStep(idx: number) {
    if (!result || !result[idx]) return;
    navigator.clipboard.writeText(result[idx].body).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  const inputCls =
    "w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-accent/30 focus:border-blue-accent text-ink bg-white placeholder:text-muted-2 text-sm transition-colors";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,40,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* ─── INPUT PHASE: wizard steps ─── */}
      {!result && !generating && (
        <div className="bg-cream border border-border rounded-2xl shadow-2xl w-full max-w-3xl p-8" onClick={e => e.stopPropagation()}>
          <h1 className="text-2xl font-bold text-ink mb-1">Let&apos;s generate a new sequence</h1>

          {step === 1 && (
            <div className="mt-6">
              <p className="text-blue-accent font-medium mb-2">What is the name of your company?</p>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && canContinue() && setStep(2)}
                placeholder="Acme Inc."
                autoFocus
                className={inputCls}
              />
              <div className="flex items-center gap-4 mt-8">
                <button onClick={onClose} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Cancel</button>
                <button onClick={() => setStep(2)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
              </div>
            </div>
          )}

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
                <button onClick={() => setStep(1)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                <button onClick={() => setStep(3)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6">
              <p className="text-blue-accent font-medium mb-1">Who is your target audience?</p>
              <p className="text-xs text-muted mb-2">Provide 2-3 sentences of information.</p>
              <input
                type="text"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                onKeyDown={e => e.key === "Enter" && canContinue() && setStep(4)}
                placeholder="Agencies and B2B companies"
                className={inputCls}
              />
              <div className="flex items-center gap-4 mt-4">
                <button onClick={() => setStep(2)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                <button onClick={() => setStep(4)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
              </div>
            </div>
          )}

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
                <button onClick={() => setStep(3)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                <button onClick={() => setStep(5)} disabled={!canContinue()} className={`btn btn-primary hover:bg-blue-accent-hover ${!canContinue() ? "opacity-50 cursor-not-allowed" : ""}`}>Continue</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mt-6">
              <p className="text-blue-accent font-medium mb-1">How many emails should the sequence include?</p>
              <p className="text-xs text-muted mb-2">The AI will write this many emails, from first touch to follow-ups.</p>
              <div className="flex items-center gap-2">
                {[2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setStepCount(n)}
                    className={`px-4 py-2.5 border rounded-lg text-sm font-medium transition-all cursor-pointer ${stepCount === n ? "border-blue-accent bg-blue-light text-blue-accent" : "border-border text-muted hover:bg-white"}`}
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
                <button onClick={() => setStep(4)} className="text-blue-accent font-medium text-sm hover:underline cursor-pointer">Back</button>
                <button onClick={generate} className="btn btn-primary hover:bg-blue-accent-hover">Generate sequence</button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      )}

      {/* ─── LOADING STATE ─── */}
      {generating && (
        <div className="bg-cream border border-border rounded-2xl shadow-2xl w-full max-w-3xl p-12 text-center" onClick={e => e.stopPropagation()}>
          <div className="mx-auto mb-6 h-10 w-10 border-[3px] border-border border-t-blue-accent rounded-full animate-spin" />
          <h3 className="text-xl font-semibold text-ink">Generating your sequence…</h3>
          <p className="text-sm text-muted mt-2">The AI is writing your {stepCount}-email sequence based on your inputs.</p>
        </div>
      )}

      {/* ─── RESULT PHASE: DeepSeek-style split view ─── */}
      {result && (
        <div
          className="bg-white w-full max-w-[1060px] rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden"
          style={{ height: "82vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <h1 className="text-[17px] font-bold text-ink">Your generated sequence</h1>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-muted hover:text-blue-accent hover:border-blue-accent transition-colors cursor-pointer"
            >
              <Cancel01Icon size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left — Editable inputs */}
            <div className="w-[35%] p-5 overflow-y-auto border-r border-border shrink-0">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Company name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">What do you offer?</label>
                  <textarea
                    value={offerDetails}
                    onChange={e => setOfferDetails(e.target.value)}
                    rows={4}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Target audience</label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Case studies</label>
                  <textarea
                    value={caseStudies}
                    onChange={e => setCaseStudies(e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Steps</label>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setStepCount(n)}
                        className={`flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                          stepCount === n
                            ? "border-blue-accent bg-blue-light text-blue-accent"
                            : "border-border text-muted bg-white hover:border-blue-accent/50"
                        }`}
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
                      className="w-14 px-2 py-2 border border-border rounded-lg text-[13px] text-center text-ink focus:outline-none focus:border-blue-accent bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Generated sequence cards */}
            <div className="flex-1 overflow-y-auto bg-cream p-5">
              <div className="space-y-4 pb-4">
                {result.map((s, i) => (
                  <div
                    key={i}
                    className={`bg-white border rounded-xl p-5 transition-all cursor-pointer ${
                      previewIdx === i
                        ? "border-blue-accent shadow-[0_4px_16px_rgba(37,99,235,0.08)]"
                        : "border-border hover:border-blue-accent/50"
                    }`}
                    onClick={() => setPreviewIdx(i)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-blue-light flex items-center justify-center text-[11px] font-bold text-blue-accent">
                        {i + 1}
                      </div>
                      <span className="text-[11px] font-semibold text-blue-accent uppercase tracking-wider">
                        {i === 0 ? "Initial outreach" : `Follow-up ${i}`} · Step {i + 1}
                      </span>
                    </div>
                    <div className="text-[15px] font-bold text-ink mb-3">
                      Subject: {fillVariables(s.subject)}
                    </div>
                    <div className="bg-cream border border-border rounded-lg p-4 text-[13px] text-ink leading-[1.7]">
                      <div dangerouslySetInnerHTML={{ __html: htmlToPreview(fillVariables(s.body)) }} />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={e => { e.stopPropagation(); copyStep(i); }}
                        className="px-3 py-1.5 rounded-md text-[11px] font-semibold border border-border bg-white text-muted hover:border-blue-accent hover:text-blue-accent transition-colors cursor-pointer"
                      >
                        {copiedIdx === i ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-white shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium border border-border bg-white text-muted hover:border-blue-accent hover:text-blue-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={generating}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border border-border bg-white text-muted hover:border-blue-accent hover:text-blue-accent transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshIcon size={14} />
                Regenerate
              </button>
              <button
                onClick={() => { onGenerated(result); onClose(); }}
                className="px-5 py-2 rounded-lg text-[13px] font-semibold bg-blue-accent text-white hover:bg-blue-accent-hover transition-colors cursor-pointer"
              >
                Use Sequence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
