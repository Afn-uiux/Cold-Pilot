"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { VARIABLE_LIST, processSpintax, getPersonalizedPreview } from "@/engine/personalize";

import Select from "@/components/select";
import ConfirmModal from "@/components/confirm-modal";

type CampaignState = "draft" | "active" | "paused";
type Step = { id?: string; type: string; subject: string; bodyHtml: string; delayDays: number; delayUnit: string; order: number };

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("analytics");
  const [state, setState] = useState<CampaignState>("draft");
  const [steps, setSteps] = useState<Step[]>([{ type: "email", subject: "", bodyHtml: "", delayDays: 0, delayUnit: "days", order: 0 }]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStepIdx, setAiStepIdx] = useState(0);
  const [aiDropdownStep, setAiDropdownStep] = useState<number | null>(null);
  const [variablesPanelStep, setVariablesPanelStep] = useState<number | null>(null);
  const [previewStep, setPreviewStep] = useState<number | null>(null);
  const [senderEmail, setSenderEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [leadList, setLeadList] = useState<any[]>([]);
  const [varOverrides, setVarOverrides] = useState<Record<string, string>>({});
  const [testSending, setTestSending] = useState(false);
  const [deliverabilityScore, setDeliverabilityScore] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  async function loadTemplates() {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch {}
  }

  function selectTemplate(t: any) {
    const i = aiStepIdx;
    updateStep(i, "subject", t.subject || "");
    updateStep(i, "bodyHtml", t.bodyHtml || "");
    setShowTemplates(false);
  }

  async function runAi(action: string, stepIndex: number) {
    setAiStepIdx(stepIndex);
    setAiLoading(true);
    try {
      const step = steps[stepIndex];
      const text = step.bodyHtml || step.subject || "";
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, context: "outreach" }),
      });
      const data = await res.json();
      if (data.result) {
        if (action === "spin" || action === "write") {
          updateStep(stepIndex, "bodyHtml", steps[stepIndex].bodyHtml + "\n\n" + data.result);
        } else if (action === "check") {
          alert(data.result);
        }
      }
    } catch {}
    setAiLoading(false);
  }

  useEffect(() => {
    fetch(`/api/campaigns?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        setCampaign(data);
        setState(data.status || "draft");
        if (data.steps?.length > 0) {
          setSteps(data.steps.map((s: any) => ({
            id: s.id, type: s.type, subject: s.subject || "",
            bodyHtml: s.bodyHtml || "", delayDays: s.delayDays ?? 0,
            delayUnit: s.delayUnit || "days", order: s.order,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (previewStep !== null) {
      fetch(`/api/leads?campaignId=${id}`)
        .then(r => r.json())
        .then(data => setLeadList(Array.isArray(data) ? data : []))
        .catch(() => {});
      setVarOverrides({});
      setSelectedLeadId("");
      setDeliverabilityScore(null);
      setTestMsg("");
      setRecipientEmail("");
      setSenderEmail("");
    }
  }, [previewStep, id]);

  useEffect(() => {
    if (!selectedLeadId) return;
    const lead = leadList.find(l => l.id === selectedLeadId);
    if (!lead) return;
    setVarOverrides({
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      companyName: lead.company || "",
      personalization: lead.personalization || "",
      phone: lead.phone || "",
      website: lead.website || "",
      accountSignature: "",
    });
  }, [selectedLeadId, leadList]);

  useEffect(() => {
    function handleClick() { setAiDropdownStep(null); setVariablesPanelStep(null); }
    if (aiDropdownStep !== null || variablesPanelStep !== null) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [aiDropdownStep, variablesPanelStep]);

  const tabs = ["Analytics", "Leads", "Sequences", "Schedule", "Options"];

  async function handlePublish() {
    const res = await fetch(`/api/campaigns?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (res.ok) {
      setState("active");
      setCampaign((prev: any) => ({ ...prev, status: "active" }));
    }
  }

  async function handlePause() {
    const res = await fetch(`/api/campaigns?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    if (res.ok) { setState("paused"); setCampaign((prev: any) => ({ ...prev, status: "paused" })); }
  }

  async function handleResume() {
    const res = await fetch(`/api/campaigns?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (res.ok) { setState("active"); setCampaign((prev: any) => ({ ...prev, status: "active" })); }
  }

  async function saveSteps() {
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch(`/api/campaigns?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: steps.filter(s => s.type === "email") }),
      });
      if (res.ok) setSaveMsg("Sequence saved!");
      else {
        const err = await res.text();
        setSaveMsg(`Failed: ${err.slice(0, 100)}`);
      }
    } catch (e: any) { setSaveMsg(`Error: ${e.message}`); }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  }

  function addStep() {
    const lastSubject = steps.length > 0 ? steps[steps.length - 1].subject : "";
    const reSubject = lastSubject ? `Re: ${lastSubject.replace(/^Re:\s*/i, "")}` : "";
    setSteps([...steps, { type: "email", subject: reSubject, bodyHtml: "", delayDays: 0, delayUnit: "days", order: steps.length }]);
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, j) => j !== i));
  }

  function updateStep(i: number, field: string, val: any) {
    setSteps(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }

  function moveStep(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps(prev => { const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }

  function insertVariable(i: number, field: "subject" | "bodyHtml", varKey: string) {
    const step = steps[i];
    updateStep(i, field, (step[field] || "") + `{{${varKey}}}`);
  }

  function wrapFormat(stepIdx: number, prefix: string, suffix: string) {
    const el = document.querySelector(`[data-step-textarea="${stepIdx}"]`) as HTMLTextAreaElement;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = steps[stepIdx]?.bodyHtml || "";
    const selected = text.substring(start, end);
    const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    updateStep(stepIdx, "bodyHtml", newText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function handleLink(stepIdx: number) {
    const url = prompt("Enter URL:", "https://");
    if (!url) return;
    const el = document.querySelector(`[data-step-textarea="${stepIdx}"]`) as HTMLTextAreaElement;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = steps[stepIdx]?.bodyHtml || "";
    const selected = text.substring(start, end) || "link";
    const linkHtml = `<a href="${url}">${selected}</a>`;
    const newText = text.slice(0, start) + linkHtml + text.slice(end);
    updateStep(stepIdx, "bodyHtml", newText);
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

  function getPreviewContent(stepIdx: number): string {
    return fillVariables(steps[stepIdx]?.bodyHtml || "");
  }

  async function sendTestEmail() {
    if (!recipientEmail?.includes("@")) { setTestMsg("Enter a valid recipient email"); return; }
    setTestSending(true); setTestMsg(""); setDeliverabilityScore(null);
    try {
      const step = steps[previewStep!];
      const subject = fillVariables(step?.subject || "");
      const body = fillVariables(step?.bodyHtml || "");
      const res = await fetch("/api/campaigns/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: id,
          stepIndex: previewStep,
          subject,
          bodyHtml: body,
          senderEmail: senderEmail || undefined,
          recipientEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestMsg("Test email sent successfully!");
        if (data.deliverabilityScore) setDeliverabilityScore(data.deliverabilityScore);
      } else {
        setTestMsg(data.error || "Failed to send test email");
      }
    } catch (e: any) {
      setTestMsg(`Error: ${e.message}`);
    }
    setTestSending(false);
  }

  function countSpintax(text: string): number {
    const standard = text.match(/\{[^}]+\|/g);
    const random = text.match(/\{\{RANDOM\s*\|/gi);
    return (standard ? standard.length : 0) + (random ? random.length : 0);
  }

  if (loading) return <div className="px-6 lg:px-10 pt-8 text-sm text-muted">Loading...</div>;

  return (
    <div>
      <header className="px-6 lg:px-10 pt-6 pb-0">
        <Link href="/dashboard/campaigns" className="text-sm text-muted hover:text-blue-accent flex items-center gap-1.5 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Campaigns
        </Link>
        <div className="flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-[clamp(24px,3vw,32px)] font-medium tracking-tight leading-tight">{campaign?.name || "Campaign"}</h1>
            <span className={`badge ${state}`}>{state}</span>
          </div>
        </div>
      </header>

      <div className="px-6 lg:px-10 mt-6 border-b border-border">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t.toLowerCase())}
              className={`text-sm py-3 px-5 border-b-2 transition-colors whitespace-nowrap ${tab === t.toLowerCase() ? "border-blue-accent text-blue-accent" : "border-transparent text-muted hover:text-blue-accent"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 lg:px-10 pt-6 pb-16">
        {tab === "analytics" && <AnalyticsTab campaignId={id} state={state} onPublish={handlePublish} onPause={handlePause} onResume={handleResume} />}

        {tab === "leads" && <LeadsTab campaignId={id} />}

        {tab === "sequences" && (
          <div className="max-w-4xl space-y-6">
            {saveMsg && (
              <div className={`text-sm px-4 py-3 rounded-lg ${saveMsg.includes("saved") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {saveMsg}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-cream-2 border border-border rounded-lg p-3">
              <button onClick={saveSteps} disabled={saving} className="btn btn-primary btn-sm min-w-[130px]">
                {saving ? "Saving..." : "Save Sequence"}
              </button>
              <div className="w-28">
                <Select value={String(aiStepIdx)} onChange={v => setAiStepIdx(parseInt(v))}
                  options={steps.map((_, i) => ({ value: String(i), label: `Step ${i + 1}` }))}
                  placeholder="Step" triggerClassName="w-full flex items-center justify-between gap-1 bg-white border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-accent text-left" />
              </div>
            </div>

            {/* Sequence timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border hidden md:block" />

              {steps.map((step, i) => (
                <div key={i} className="relative md:pl-14 pb-10 last:pb-0">
                  {/* Timeline dot */}
                  <div className="hidden md:flex absolute left-0 top-0 w-9 h-9 rounded-full bg-white border-2 border-border/50 shadow-sm items-center justify-center text-xs font-semibold text-muted-2 z-10">
                    {i + 1}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)]">
                    {/* Step header */}
                    <div className="px-6 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col gap-0.5 md:hidden">
                          <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-[10px] text-muted-2 hover:text-blue-accent disabled:opacity-20">▲</button>
                          <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="text-[10px] text-muted-2 hover:text-blue-accent disabled:opacity-20">▼</button>
                        </div>
                        <span className={`text-xs font-semibold tracking-wide ${i === 0 ? "text-blue-accent" : "text-muted-2"}`}>
                          {i === 0 ? "Step 1 — Initial Email" : `Step ${i + 1} — Follow-up`}
                        </span>
                        {i > 0 && (
                          <span className="text-[11px] text-muted-2 bg-cream-2/60 border border-border/40 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Wait {step.delayDays} {step.delayUnit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                          className="text-muted-2 hover:text-blue-accent disabled:opacity-20 p-1.5 rounded-lg hover:bg-cream-2/60 transition-all" title="Move up">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                          className="text-muted-2 hover:text-blue-accent disabled:opacity-20 p-1.5 rounded-lg hover:bg-cream-2/60 transition-all" title="Move down">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div className="w-px h-4 bg-border/40 mx-1"></div>
                        <button onClick={() => removeStep(i)} className="text-muted-2 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all" title="Remove step">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Step body - Email Editor */}
                    <div className="border-t border-border/30">
                      <div className="p-5">
                        <div className="bg-white border border-border/40 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
                          {/* Subject row */}
                          <div className="flex items-center gap-3 pl-5 pr-4 h-[52px] border-b border-border/30">
                            <span className="text-sm font-semibold text-ink/90 w-[68px] shrink-0 tracking-tight">Subject</span>
                            <input value={step.subject} onChange={e => updateStep(i, "subject", e.target.value)}
                              placeholder="Your subject"
                              className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted-2/40 min-w-0" />
                            <div className="w-px h-5 bg-border/40 shrink-0"></div>
                            <button onClick={() => setPreviewStep(i)}
                              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-blue-accent px-2.5 py-1.5 rounded-lg hover:bg-blue-light/40 transition-all shrink-0">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              Preview
                            </button>
                            <button onClick={() => { setAiStepIdx(i); setShowTemplates(true); loadTemplates(); }}
                              className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-blue-light/40 transition-all shrink-0">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            </button>
                          </div>

                          {/* Body area */}
                          <div className="flex min-h-[260px] relative">
                            <textarea value={step.bodyHtml} onChange={e => updateStep(i, "bodyHtml", e.target.value)}
                              data-step-textarea={i}
                              className="flex-1 border-0 outline-none resize-y text-sm text-ink leading-relaxed px-5 py-[18px] placeholder:text-muted-2/35 bg-transparent"
                              placeholder="Start typing here…" />
                            {countSpintax(step.bodyHtml) > 0 && (
                              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-blue-accent/60 bg-blue-light/30 px-2 py-0.5 rounded-full pointer-events-none">
                                {countSpintax(step.bodyHtml)} spintax
                              </div>
                            )}
                            {variablesPanelStep === i && (
                              <div className="w-[250px] shrink-0 border-l border-border/30 bg-cream-2/20 p-3 overflow-y-auto">
                                <div className="text-[11px] font-semibold text-muted-2 uppercase tracking-wider mb-2 px-1">Variables</div>
                                <div className="space-y-0.5">
                                  {VARIABLE_LIST.map(v => (
                                    <button key={v.key} onClick={() => insertVariable(i, "bodyHtml", v.key)}
                                      className="w-full flex items-center justify-between px-3 py-[7px] rounded-lg text-xs hover:bg-white/70 transition-all group cursor-pointer">
                                      <span className="text-muted group-hover:text-blue-accent font-medium">{v.label}</span>
                                      <code className="text-[10px] font-mono text-muted-3 group-hover:text-blue-accent/70">{v.tag}</code>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Toolbar */}
                          <div className="flex items-center gap-0.5 px-3 py-2 border-t border-border/30 bg-cream-2/30">
                            <button onClick={saveSteps} disabled={saving}
                              className="flex items-center gap-1.5 bg-blue-accent hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-[0_1px_2px_0_rgba(0,0,0,0.06)] whitespace-nowrap">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                              {saving ? "Saving…" : "Save"}
                            </button>

                            <div className="w-px h-5 bg-border/40 shrink-0 mx-1.5"></div>

                            <div className="relative">
                              <button onClick={e => { e.stopPropagation(); setAiDropdownStep(aiDropdownStep === i ? null : i); }}
                                className="flex items-center gap-1.5 text-xs text-muted hover:text-blue-accent px-2.5 py-1.5 rounded-lg hover:bg-white/70 transition-all">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                AI Tools
                              </button>
                              {aiDropdownStep === i && (
                                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-border/50 rounded-xl shadow-lg z-20 py-1.5 overflow-hidden">
                                  <button onClick={() => { setAiDropdownStep(null); setAiStepIdx(i); runAi("spin", i); }}
                                    disabled={aiLoading} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-muted hover:text-blue-accent hover:bg-cream-2/60 transition-all disabled:opacity-30">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M9 12l3 3 3-3"/><path d="M6 18h12"/></svg>
                                    AI Spin Tax
                                  </button>
                                  <button onClick={() => { setAiDropdownStep(null); setAiStepIdx(i); runAi("check", i); }}
                                    disabled={aiLoading} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-muted hover:text-blue-accent hover:bg-cream-2/60 transition-all disabled:opacity-30">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                                    Word Checker
                                  </button>
                                  <button onClick={() => { setAiDropdownStep(null); setAiStepIdx(i); runAi("write", i); }}
                                    disabled={aiLoading} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-muted hover:text-blue-accent hover:bg-cream-2/60 transition-all disabled:opacity-30">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    AI Writer
                                  </button>
                                </div>
                              )}
                            </div>
                            <button onClick={() => { setAiStepIdx(i); setShowTemplates(true); loadTemplates(); }}
                              className="flex items-center gap-1.5 text-xs text-muted hover:text-blue-accent px-2.5 py-1.5 rounded-lg hover:bg-white/70 transition-all">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                              Templates
                            </button>

                            <button onClick={e => { e.stopPropagation(); setVariablesPanelStep(variablesPanelStep === i ? null : i); }}
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${variablesPanelStep === i ? "text-blue-accent bg-blue-light/40" : "text-muted hover:text-blue-accent hover:bg-white/70"}`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                              Variables
                            </button>

                            <div className="flex-1"></div>

                            <div className="flex items-center gap-0.5">
                              <button onClick={() => wrapFormat(i, "<strong>", "</strong>")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Bold">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 010 8H6z"/></svg>
                              </button>
                              <button onClick={() => wrapFormat(i, "<em>", "</em>")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Italic">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                              </button>
                              <button onClick={() => wrapFormat(i, "<u>", "</u>")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Underline">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                              </button>
                              <button onClick={() => wrapFormat(i, "<s>", "</s>")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Strikethrough">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><path d="M16.5 7.5C16.5 5.5 14 4 12 4c-2.5 0-4 1.5-4 3.5"/><path d="M7.5 16.5C7.5 18.5 10 20 12 20c2.5 0 4-1.5 4-3.5"/></svg>
                              </button>
                            </div>

                            <div className="w-px h-5 bg-border/40 shrink-0 mx-0.5"></div>

                            <div className="flex items-center gap-0.5">
                              <button onClick={() => handleLink(i)} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                              </button>
                              <button onClick={() => insertVariable(i, "bodyHtml", "accountSignature")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Signature">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            </div>

                            <div className="w-px h-5 bg-border/40 shrink-0 mx-0.5"></div>

                            <button className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Source">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                            </button>
                          </div>
                        </div>

                        {/* Delay — only for follow-ups */}
                        {i > 0 && (
                          <div className="flex items-center gap-2.5 flex-wrap bg-cream-2/40 border border-border/30 rounded-xl px-5 py-3.5 mt-3">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-2 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span className="text-xs text-muted">Send this follow-up</span>
                            <input type="number" min={0} value={step.delayDays} onChange={e => updateStep(i, "delayDays", parseInt(e.target.value) || 0)}
                              className="w-14 bg-white border border-border/50 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-blue-accent transition-all" />
                            <div className="w-28">
                              <Select value={step.delayUnit} onChange={v => updateStep(i, "delayUnit", v)}
                                options={[{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" }]}
                                triggerClassName="w-full flex items-center justify-between gap-1 bg-white border border-border/50 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-accent transition-all text-left" />
                            </div>
                            <span className="text-xs text-muted">after the previous email</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add step button */}
            <button onClick={addStep}
              className="w-full border-2 border-dashed border-border rounded-xl py-4 text-sm text-muted hover:border-blue-accent hover:text-blue-accent hover:bg-blue-light/20 transition-all flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {steps.length === 0 ? "Add a step" : "Add Follow-up Step"}
            </button>
          </div>
        )}

        {/* Test Email Modal */}
        {previewStep !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPreviewStep(null)}>
            <div className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] w-full max-w-[780px] max-h-[90vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <h2 className="text-xl font-bold text-[#1a1a1a]">Test Email</h2>
                <button onClick={() => setPreviewStep(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>

              {/* Body - two columns */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left column - Config */}
                  <div className="w-full md:w-[220px] shrink-0 space-y-5">
                    {/* Send from */}
                    <div>
                      <label className="text-xs text-[#666] block mb-1">Send from:</label>
                      <div className="text-sm text-[#222] font-medium mb-1.5">{campaign?.emailAccounts?.[0]?.email || campaign?.user?.email || "your@email.com"}</div>
                      <input value={senderEmail} onChange={e => setSenderEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent transition-colors placeholder:text-gray-400" />
                    </div>

                    {/* Load data for lead */}
                    <div>
                      <label className="text-xs text-[#666] block mb-1">Load data for lead:</label>
                      <select value={selectedLeadId} onChange={e => setSelectedLeadId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent transition-colors bg-white text-[#222]">
                        <option value="">Select a lead...</option>
                        {leadList.map(l => (
                          <option key={l.id} value={l.id}>{l.firstName || l.email} {l.lastName || ""}</option>
                        ))}
                      </select>
                    </div>

                    {/* Variables */}
                    <div>
                      <label className="text-xs text-[#666] block mb-2 font-medium">Variables</label>
                      <div className="space-y-2.5">
                        {VARIABLE_LIST.map(v => (
                          <div key={v.key}>
                            <div className="text-xs text-[#666] mb-0.5">{v.label}</div>
                            <input value={varOverrides[v.key] ?? ""} onChange={e => setVarOverrides(prev => ({ ...prev, [v.key]: e.target.value }))}
                              placeholder="Enter variable"
                              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-accent transition-colors placeholder:text-gray-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right column - Preview */}
                  <div className="flex-1 min-w-0 space-y-5">
                    {/* Send to */}
                    <div>
                      <label className="text-xs text-[#666] block mb-1">Send to:</label>
                      <div className="text-sm text-[#222] font-medium mb-1.5">{recipientEmail || "your@email.com"}</div>
                      <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent transition-colors placeholder:text-gray-400" />
                    </div>

                    {/* Email Preview canvas */}
                    <div>
                      <div className="bg-[#f7f8fa] border border-gray-200 rounded-lg p-5 min-h-[240px] max-h-[360px] overflow-y-auto">
                        {steps[previewStep] ? (
                          <>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Subject</div>
                            <div className="text-sm font-semibold text-[#222] mb-4 pb-3 border-b border-gray-200">
                              {fillVariables(steps[previewStep]?.subject || "") || "(no subject)"}
                            </div>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{getPreviewContent(previewStep)}</div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400">No content to preview</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status messages */}
                {testMsg && (
                  <div className={`mt-4 text-sm px-4 py-2.5 rounded-lg ${testMsg.includes("successfully") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {testMsg}
                  </div>
                )}
                {deliverabilityScore !== null && (
                  <div className="mt-3 text-sm text-[#666] flex items-center gap-2">
                    <span>Deliverability Score:</span>
                    <span className={`font-semibold ${deliverabilityScore >= 7 ? "text-green-600" : deliverabilityScore >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                      {deliverabilityScore}/10
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
                <button disabled={testSending} onClick={async () => {
                  setTestMsg(""); setDeliverabilityScore(null);
                  try {
                    const res = await fetch("/api/deliverability", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ campaignId: id }),
                    });
                    const data = await res.json();
                    if (data.score !== undefined) setDeliverabilityScore(data.score);
                    else setTestMsg(data.error || "Could not compute score");
                  } catch { setTestMsg("Failed to check deliverability"); }
                }}
                  className="text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Check Deliverability Score
                </button>
                <button onClick={sendTestEmail} disabled={testSending}
                  className="text-sm text-white bg-blue-accent hover:bg-blue-700 rounded-lg px-5 py-2 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {testSending && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {testSending ? "Sending..." : "Send test email"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates Modal */}
        {showTemplates && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTemplates(false)}>
            <div className="bg-cream rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-medium text-sm">Select Template</h3>
                <button onClick={() => setShowTemplates(false)} className="text-muted-2 hover:text-blue-accent text-lg leading-none">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {templates.length === 0 && <p className="text-sm text-muted py-8 text-center">No templates saved yet. <Link href="/dashboard/templates" className="text-blue-accent hover:underline">Create one</Link></p>}
                {templates.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t)}
                    className="w-full text-left bg-cream-2 border border-border rounded-lg px-4 py-3 hover:border-blue-accent hover:bg-blue-light/20 transition-all">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-2 mt-0.5 line-clamp-1">{t.subject}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "schedule" && <ScheduleTab campaignId={id} />}
        {tab === "options" && <OptionsTab campaignId={id} />}
        
      </div>
    </div>
  );
}

function LeadsTab({ campaignId }: { campaignId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  useEffect(() => {
    fetch(`/api/leads?campaignId=${campaignId}`).then(r => r.json()).then(data => setLeads(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);
  async function handleRemove(id: string) {
    const res = await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    if (res.ok) setLeads(prev => prev.filter(l => l.id !== id));
  }
  async function handleRemoveAll() {
    await fetch(`/api/leads?campaignId=${campaignId}`, { method: "DELETE" });
    setLeads([]);
    setShowConfirmAll(false);
  }
  if (loading) return <div className="text-sm text-muted py-8">Loading...</div>;
  if (leads.length === 0) return <div className="empty-state"><h3>Add some leads to get started</h3><p>Import a CSV or paste a list to add leads to this campaign.</p><Link href="/dashboard/leads" className="btn btn-primary">Import Leads</Link></div>;
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted">{leads.length} leads</p>
        <button onClick={() => setShowConfirmAll(true)} className="btn btn-ghost btn-sm text-red-600 hover:text-red-600">Delete All</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Status</th><th></th></tr></thead>
          <tbody>{leads.map((l: any) => (
            <tr key={l.id}>
              <td>{l.email}</td>
              <td>{[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}</td>
              <td><span className={`badge ${l.status === "replied" ? "active" : l.status === "completed" ? "completed" : ""}`}>{l.status}</span></td>
              <td><button onClick={() => handleRemove(l.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <ConfirmModal
        open={showConfirmAll}
        title="Delete all leads?"
        message="This will permanently delete all leads from this campaign."
        confirmLabel="Delete all"
        onConfirm={handleRemoveAll}
        onCancel={() => setShowConfirmAll(false)}
        variant="danger"
      />
    </>
  );
}

function Pct({ part, total }: { part: number; total: number }) {
  if (!total) return <span className="text-muted-2"> | 0%</span>;
  const val = (part / total) * 100;
  const fmt = val < 0.1 ? val.toFixed(2) : val.toFixed(1);
  return <span className="text-muted-2"> | {fmt.replace(/\.?0+$/, "")}%</span>;
}

function AnalyticsTab({ campaignId, state, onPublish, onPause, onResume }: { campaignId: string; state: string; onPublish: () => void; onPause: () => void; onResume: () => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState("Step Analytics");
  const [variantToggles, setVariantToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    function fetchStats() {
      fetch(`/api/stats?campaignId=${campaignId}&range=all`)
        .then(r => r.json())
        .then(data => { if (active) setStats(data); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
    }

    fetchStats();

    // Auto-refresh every 30 seconds while viewing an active campaign
    const interval = state === "active" ? setInterval(fetchStats, 30_000) : null;

    return () => { active = false; if (interval) clearInterval(interval); };
  }, [campaignId, state]);

  function toggleVariant(key: string) {
    setVariantToggles(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (state === "draft") {
    return (
      <div className="space-y-6">
        <div className="metrics">
          {["Sequence started", "Open rate", "Click rate", "Reply rate", "Conversions"].map(m => (
            <div key={m} className="metric"><div className="metric-label">{m}</div><div className="metric-value !text-2xl text-muted-2">—</div></div>
          ))}
        </div>
        <div className="card text-center py-16"><p className="text-muted text-sm">No data available</p><p className="text-muted-2 text-xs mt-2">Publish the campaign to start collecting data</p></div>
        <div className="flex gap-3 justify-center"><button onClick={onPublish} className="btn btn-primary">Publish</button></div>
      </div>
    );
  }

  if (loading) return <div className="text-center text-muted py-16 text-sm">Loading...</div>;

  const s = stats?.summary || {};
  const d = stats?.detailed || {};
  const campaignData = stats?.campaigns?.[0] || {};
  const openTrackingEnabled = campaignData.openTracking === true;
  const clickTrackingEnabled = campaignData.clickTracking === true;
  const steps: any[] = stats?.stepAnalytics?.[0]?.steps || [];
  const activity: { date: string; count: number }[] = stats?.activity || [];
  const tabs = ["Step Analytics", "Activity", "Bounces", "Suppressed"];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="metrics">
        <div className="metric"><div className="metric-label">Sequence started</div><div className="metric-value">{s.sequenceStarted || 0}</div></div>
        <div className="metric">
          <div className="metric-label">
            Open rate
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${openTrackingEnabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {openTrackingEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="metric-value">{s.openRate || 0}%</div>
        </div>
        <div className="metric">
          <div className="metric-label">
            Click rate
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clickTrackingEnabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {clickTrackingEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="metric-value">{s.clickRate || 0}%</div>
        </div>
        <div className="metric"><div className="metric-label">Reply rate</div><div className="metric-value">{s.replyRate || 0}%</div></div>
        <div className="metric"><div className="metric-label">Conversions</div><div className="metric-value">{s.conversions || 0}</div></div>
      </div>

      {/* Tabbed card */}
      <div className="card !p-0 overflow-hidden">
        {/* Tabs header */}
        <div className="flex items-center gap-8 border-b border-border px-8 pt-6">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setAnalyticsTab(tab)}
              className={`relative pb-4 text-sm font-medium transition-colors ${analyticsTab === tab ? "text-blue-accent" : "text-muted hover:text-blue-accent"}`}>
              {tab}
              {analyticsTab === tab && <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-blue-accent" />}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-2 pb-4">
            {state === "active" ? (
              <button onClick={onPause} className="btn btn-ghost btn-xs">Pause</button>
            ) : (
              <button onClick={onResume} className="btn btn-primary btn-xs">Resume</button>
            )}
          </div>
        </div>

        {/* Step Analytics */}
        {analyticsTab === "Step Analytics" && (
          <div className="overflow-x-auto px-8 pb-6">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr>
                  <th className="w-[180px] pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Step</th>
                  <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Sent</th>
                  <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Opened</th>
                  <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Replied</th>
                  <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Clicked</th>
                  <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Opp.</th>
                </tr>
              </thead>
              <tbody>
                {steps.length > 0 ? steps.map((st: any) => (
                  <tr key={st.step} className="border-t border-border">
                    <td className="py-4 text-sm font-semibold text-ink">Step {st.step}</td>
                    <td className="py-4 text-sm font-semibold text-ink">{st.sent}</td>
                    <td className="py-4 text-sm"><span className="font-medium text-ink">{st.opened}</span><Pct part={st.opened} total={st.sent} /></td>
                    <td className="py-4 text-sm"><span className="font-medium text-ink">{st.replied}</span><Pct part={st.replied} total={st.sent} /></td>
                    <td className="py-4 text-sm"><span className="font-medium text-ink">{st.clicked}</span><Pct part={st.clicked} total={st.sent} /></td>
                    <td className="py-4 text-sm font-medium text-ink">{st.opportunities}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="text-center text-muted-2 py-12 text-sm">No steps created for this campaign</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Activity */}
        {analyticsTab === "Activity" && (
          <div className="px-8 pb-6">
            {activity.length > 0 ? (
              <div>
                <div className="flex items-center justify-between pt-6 pb-4">
                  <span className="text-xs text-muted">{activity.reduce((sum, a) => sum + a.count, 0)} emails sent</span>
                </div>
                <div className="h-44 flex items-end justify-between gap-1 px-2">
                  {activity.map((a) => {
                    const maxCount = Math.max(...activity.map(x => x.count), 1);
                    return (
                      <div key={a.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                        <div className="w-full bg-blue-accent/30 hover:bg-blue-accent/60 rounded-sm transition-colors" style={{ height: `${(a.count / maxCount) * 100}%`, minHeight: 2 }} />
                        <span className="text-[9px] text-muted-2 truncate w-full text-center">{formatDay(a.date)}</span>
                        <div className="absolute bottom-8 hidden group-hover:block bg-ink text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">{a.count} sent</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-muted-2">No data yet</div>
            )}
          </div>
        )}

        {/* Bounces */}
        {analyticsTab === "Bounces" && <BouncesTab stats={stats} />}

        {/* Suppressed */}
        {analyticsTab === "Suppressed" && <SuppressedTab campaignId={campaignId} />}
      </div>
    </div>
  );
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPct(val: number): string {
  if (val === 0) return "0";
  const s = val.toFixed(2);
  return s.replace(/\.00$/, "");
}

function ScheduleTab({ campaignId }: { campaignId: string }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noEndDate, setNoEndDate] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/campaigns?id=${campaignId}`)
      .then(r => r.json())
      .then(data => {
        if (data.startDate) setStartDate(new Date(data.startDate).toISOString().split("T")[0]);
        if (data.endDate) setEndDate(new Date(data.endDate).toISOString().split("T")[0]);
        setNoEndDate(data.noEndDate ?? true);
        if (data.schedules?.length > 0) {
          setSchedules(data.schedules.map((s: any) => ({
            id: s.id,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            timezone: s.timezone || "America/New_York",
            days: typeof s.days === "string" ? JSON.parse(s.days) : s.days,
          })));
        } else {
          setSchedules([{ id: "", name: "Schedule 1", startTime: "09:00", endTime: "18:00", timezone: "America/New_York", days: [true, true, true, true, true, false, false] }]);
        }
      })
      .catch(() => {
        setStartDate(new Date().toISOString().split("T")[0]);
        setSchedules([{ id: "", name: "Schedule 1", startTime: "09:00", endTime: "18:00", timezone: "America/New_York", days: [true, true, true, true, true, false, false] }]);
      });
  }, [campaignId]);

  async function saveAll() {
    setSaving(true);
    setMsg("");
    try {
      await fetch(`/api/campaigns?id=${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: noEndDate ? null : (endDate ? new Date(endDate).toISOString() : null),
          noEndDate,
          schedules: schedules.map((s, i) => ({
            id: s.id,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            timezone: s.timezone,
            days: JSON.stringify(s.days),
            order: i,
          })),
        }),
      });
      setMsg("Schedule saved");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("Failed to save"); }
    setSaving(false);
  }

  function addSchedule() {
    setSchedules([...schedules, {
      id: "",
      name: `Schedule ${schedules.length + 1}`,
      startTime: "09:00",
      endTime: "18:00",
      timezone: "America/New_York",
      days: [true, true, true, true, true, false, false],
    }]);
  }

  function updateSchedule(i: number, field: string, val: any) {
    setSchedules(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }

  function removeSchedule(i: number) {
    setSchedules(prev => prev.filter((_, j) => j !== i));
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="max-w-2xl space-y-4">
      {msg && <div className={`text-sm px-4 py-3 rounded-lg ${msg.includes("saved") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg}</div>}

      <div className="card">
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-[#666] mb-1.5">Start</label>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
                <button onClick={() => setStartDate(new Date().toISOString().split("T")[0])}
                  className="text-xs text-blue-accent hover:underline whitespace-nowrap">Now</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#666] mb-1.5">End</label>
              <div className="flex items-center gap-2">
                <input type="date" value={noEndDate ? "" : endDate} onChange={e => setEndDate(e.target.value)}
                  disabled={noEndDate}
                  className="border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent disabled:opacity-40" />
                <label className="flex items-center gap-1.5 text-xs text-[#666] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={noEndDate} onChange={e => setNoEndDate(e.target.checked)}
                    className="w-3.5 h-3.5" />
                  No end
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-[#e5e7eb]" />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">Schedules</h3>
        <button onClick={addSchedule} className="text-sm text-blue-accent hover:underline font-medium">+ Add schedule</button>
      </div>

      {schedules.map((schedule, i) => (
        <div key={i} className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="block text-xs text-[#666] mb-1.5">Schedule Name</label>
              <input value={schedule.name} onChange={e => updateSchedule(i, "name", e.target.value)}
                className="w-full border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
            </div>
            {schedules.length > 1 && (
              <button onClick={() => removeSchedule(i)} className="text-xs text-red-500 hover:text-red-700 ml-3 mt-5">Remove</button>
            )}
          </div>

          <div>
            <label className="block text-xs text-[#666] mb-1.5 font-medium">Timing</label>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-[#999] mr-2">From</span>
                <input type="time" value={schedule.startTime} onChange={e => updateSchedule(i, "startTime", e.target.value)}
                  className="border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
              </div>
              <div>
                <span className="text-xs text-[#999] mr-2">To</span>
                <input type="time" value={schedule.endTime} onChange={e => updateSchedule(i, "endTime", e.target.value)}
                  className="border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#666] mb-1.5 font-medium">Timezone</label>
            <Select value={schedule.timezone} onChange={tz => updateSchedule(i, "timezone", tz)}
              options={[
                { value: "America/New_York", label: "Eastern Time" },
                { value: "America/Chicago", label: "Central Time" },
                { value: "America/Denver", label: "Mountain Time" },
                { value: "America/Los_Angeles", label: "Pacific Time" },
              ]}
              placeholder="Select timezone" />
          </div>

          <div>
            <label className="block text-xs text-[#666] mb-1.5 font-medium">Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, di) => (
                <button key={d} onClick={() => {
                  const next = [...schedule.days];
                  next[di] = !next[di];
                  updateSchedule(i, "days", next);
                }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    schedule.days[di]
                      ? "bg-blue-accent text-white border-blue-accent"
                      : "bg-transparent text-[#666] border-[#ddd] hover:border-blue-accent"
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-2">
        <button onClick={saveAll} disabled={saving} className="bg-blue-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-accent-hover transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function ToggleBtn({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-blue-accent" : "bg-border"}`}>
      <span className={`absolute block w-4 h-4 bg-white rounded-full top-1 transition-all ${checked ? "left-5" : "left-1"}`} />
    </button>
  );
}

function OptionsTab({ campaignId }: { campaignId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaignName, setCampaignName] = useState("My Campaign");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [openTracking, setOpenTracking] = useState(false);
  const [clickTracking, setClickTracking] = useState(false);
  const [plainTextOnly, setPlainTextOnly] = useState(false);
  const [firstEmailPlainText, setFirstEmailPlainText] = useState(false);
  const [dailySendLimit, setDailySendLimit] = useState(50);
  const [slowRamp, setSlowRamp] = useState(false);
  const [minTimeBetween, setMinTimeBetween] = useState(15);
  const [randomExtraTime, setRandomExtraTime] = useState(9);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopOnAutoReply, setStopOnAutoReply] = useState(false);
  const [unsubscribeHeader, setUnsubscribeHeader] = useState(true);
  const [ccAddresses, setCcAddresses] = useState("");
  const [bccAddresses, setBccAddresses] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/email-accounts").then(r => r.ok ? r.json() : []),
      fetch(`/api/campaigns?id=${campaignId}`).then(r => r.ok ? r.json() : {}),
    ]).then(([accs, camp]: [any, any]) => {
      const list = Array.isArray(accs) ? accs : [];
      setAccounts(list);
      if (camp) {
        setCampaignName(camp.name || "My Campaign");
        if (camp.accountIds) {
          try { setSelected(JSON.parse(camp.accountIds)); } catch { setSelected(list.map((a: any) => a.id)); }
        } else if (list.length > 0) {
          setSelected(list.map((a: any) => a.id));
        }
        setOpenTracking(camp.openTracking ?? false);
        setClickTracking(camp.clickTracking ?? false);
        setStopOnReply(camp.stopOnReply ?? true);
        setPlainTextOnly(camp.plainTextOnly ?? false);
        setFirstEmailPlainText(camp.firstEmailPlainText ?? false);
        setDailySendLimit(camp.dailySendLimit ?? 50);
        setSlowRamp(camp.slowRamp ?? false);
        setMinTimeBetween(camp.minTimeBetween ?? 15);
        setRandomExtraTime(camp.randomExtraTime ?? 9);
        setStopOnAutoReply(camp.stopOnAutoReply ?? false);
        setUnsubscribeHeader(camp.unsubscribeHeader ?? true);
        setCcAddresses(camp.ccAddresses ?? "");
        setBccAddresses(camp.bccAddresses ?? "");
      } else if (list.length > 0) {
        setSelected(list.map((a: any) => a.id));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  async function save(): Promise<boolean> {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: JSON.stringify(selected),
          openTracking,
          clickTracking,
          stopOnReply,
          plainTextOnly,
          firstEmailPlainText,
          dailySendLimit,
          slowRamp,
          rampStart: slowRamp ? new Date().toISOString() : null,
          minTimeBetween,
          randomExtraTime,
          stopOnAutoReply,
          unsubscribeHeader,
          ccAddresses,
          bccAddresses,
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        setMsg(`Failed to save: ${err.slice(0, 150) || res.status}`);
        setSaving(false);
        return false;
      }
      setMsg("Settings saved");
      setTimeout(() => setMsg(""), 3000);
      setSaving(false);
      return true;
    } catch (e: any) {
      setMsg(`Failed to save: ${e?.message || "network error"}`);
      setSaving(false);
      return false;
    }
  }

  async function launch() {
    const ok = await save();
    if (!ok) return;
    const res = await fetch(`/api/campaigns?id=${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      setMsg(`Failed to launch: ${err.slice(0, 150) || res.status}`);
      return;
    }
    window.location.reload();
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-muted-2">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {msg && <div className={`text-sm px-4 py-3 rounded-lg ${msg.includes("saved") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg}</div>}

      <h2 className="text-xl font-bold text-[#1a1a1a]">{campaignName}</h2>

      {/* Accounts to use */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#1a1a1a]">Accounts to use</label>
        <p className="text-xs text-[#666]">Select one or more accounts to send emails from</p>
        {accounts.length === 0 ? (
          <div className="bg-cream-2 border border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted mb-3">No email accounts connected.</p>
            <Link href="/dashboard/email-accounts" className="text-xs text-blue-accent font-medium hover:underline">Connect an account</Link>
          </div>
        ) : (
          <div className="relative">
            <button type="button" onClick={() => setAccountsOpen(!accountsOpen)}
              className="w-full flex items-center justify-between border border-[#ddd] rounded-lg px-3 py-2.5 text-sm text-left bg-white hover:border-blue-accent transition-colors">
              <span className={selected.length === 0 ? "text-[#999]" : "text-ink"}>
                {selected.length === 0 ? "Select accounts" : `${selected.length} account${selected.length > 1 ? "s" : ""} selected`}
              </span>
              <svg className={`w-4 h-4 text-[#666] transition-transform ${accountsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {accountsOpen && (
              <>
                <div className="absolute z-10 mt-1 w-full border border-[#ddd] rounded-lg bg-white shadow-lg p-2 space-y-0.5 max-h-60 overflow-y-auto">
                  {accounts.map(a => {
                    const isSelected = selected.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-cream-2 cursor-pointer">
                        <input type="checkbox" checked={isSelected} onChange={() => {
                          setSelected(prev => isSelected ? prev.filter(x => x !== a.id) : [...prev, a.id]);
                        }} className="w-4 h-4 accent-blue-accent" />
                        <span className="text-sm text-ink truncate">{a.email}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="fixed inset-0 z-0" onClick={() => setAccountsOpen(false)} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Stop sending on reply */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#1a1a1a]">Stop sending emails on reply</label>
        <p className="text-xs text-[#666]">Stop sending emails to a lead if a response has been received</p>
        <ToggleBtn checked={stopOnReply} onChange={() => setStopOnReply(!stopOnReply)} />
      </div>

      {/* Open & Link Tracking */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#1a1a1a]">Open &amp; Link Tracking</label>
        <p className="text-xs text-[#666]">Track email opens and link clicks</p>
        <div className="space-y-2 mt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <ToggleBtn checked={clickTracking} onChange={() => setClickTracking(!clickTracking)} />
            <span className="text-sm text-ink">Link tracking</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <ToggleBtn checked={openTracking} onChange={() => setOpenTracking(!openTracking)} />
            <span className="text-sm text-ink">Open tracking</span>
          </label>
        </div>
      </div>

      {/* Delivery Optimization */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#1a1a1a]">Delivery Optimization</label>
        <p className="text-xs text-[#666]">Disables open tracking</p>
        <div className="space-y-2 mt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={plainTextOnly} onChange={e => setPlainTextOnly(e.target.checked)} className="w-4 h-4 accent-blue-accent" />
            <span className="text-sm text-ink">Send emails as text-only (no HTML)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={firstEmailPlainText} onChange={e => setFirstEmailPlainText(e.target.checked)} className="w-4 h-4 accent-blue-accent" />
            <span className="text-sm text-ink">Send first email as text-only</span>
          </label>
        </div>
      </div>

      {/* Daily Limit */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#1a1a1a]">Daily Limit</label>
        <p className="text-xs text-[#666]">Max number of emails to send per day for this campaign</p>
        <input type="number" value={dailySendLimit} onChange={e => setDailySendLimit(parseInt(e.target.value) || 0)}
          className="w-20 border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-center" />
      </div>

      {/* Slow Ramp */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#1a1a1a]">Slow Ramp</label>
        <p className="text-xs text-[#666]">Gradually increase daily send limit over time (+2/day)</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#666]">Disable</span>
          <ToggleBtn checked={slowRamp} onChange={() => setSlowRamp(!slowRamp)} />
          <span className="text-xs text-[#666]">Enable</span>
        </div>
      </div>

      {/* Time Gap */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-[#1a1a1a]">Time Gap Between Emails</label>
        <p className="text-xs text-[#666]">Minimum delay (minutes) and random extra time (minutes) between consecutive emails</p>
        <div className="flex gap-4 items-center">
          <div>
            <span className="text-xs text-[#999]">Min delay:</span>
            <input type="number" min={0} value={minTimeBetween} onChange={e => setMinTimeBetween(parseInt(e.target.value) || 0)}
              className="w-20 border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-center ml-2" />
          </div>
          <div>
            <span className="text-xs text-[#999]">Random extra:</span>
            <input type="number" min={0} value={randomExtraTime} onChange={e => setRandomExtraTime(parseInt(e.target.value) || 0)}
              className="w-20 border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-center ml-2" />
          </div>
        </div>
      </div>

      {/* Advanced toggle */}
      <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-sm text-blue-accent font-medium hover:underline">
        {showAdvanced ? "Hide advanced options" : "Show advanced options"}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="space-y-6 pt-2">
          <hr className="border-[#e5e7eb]" />

          {/* Stop Sending on Auto-Reply */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#1a1a1a]">Stop Sending Emails on Auto-Reply</label>
            <p className="text-xs text-[#666]">Stop sending emails to a lead if an automatic response has been received, for example for out-of-office replies.</p>
            <div className="flex items-center gap-3"><span className="text-xs text-[#666]">Disable</span><ToggleBtn checked={stopOnAutoReply} onChange={() => setStopOnAutoReply(!stopOnAutoReply)} /><span className="text-xs text-[#666]">Enable</span></div>
          </div>

          {/* Insert Unsubscribe Link Header */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#1a1a1a]">Insert Unsubscribe Link Header</label>
            <p className="text-xs text-[#666]">Automatically adds an unsubscribe link to email headers for one-click unsubscribe by supported email providers</p>
            <div className="flex items-center gap-3"><span className="text-xs text-[#666]">Disable</span><ToggleBtn checked={unsubscribeHeader} onChange={() => setUnsubscribeHeader(!unsubscribeHeader)} /><span className="text-xs text-[#666]">Enable</span></div>
          </div>

          {/* CC and BCC */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#1a1a1a]">CC and BCC</label>
            <p className="text-xs text-[#666]">Add CC and BCC recipients to all emails</p>
            <button onClick={() => setShowCcBcc(!showCcBcc)} className="text-xs text-blue-accent hover:underline">
              Optional: expand to add CC or BCC recipients.
            </button>
            {showCcBcc && (
              <div className="space-y-3 mt-2">
                <div>
                  <span className="text-xs text-[#999]">CC:</span>
                  <input value={ccAddresses} onChange={e => setCcAddresses(e.target.value)} placeholder="cc@example.com"
                    className="w-full max-w-xs border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent mt-1" />
                </div>
                <div>
                  <span className="text-xs text-[#999]">BCC:</span>
                  <input value={bccAddresses} onChange={e => setBccAddresses(e.target.value)} placeholder="bcc@example.com"
                    className="w-full max-w-xs border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent mt-1" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save & Launch */}
      <div className="flex items-center gap-3 pt-4">
        <button onClick={save} disabled={saving}
          className="border border-[#ddd] rounded-lg px-6 py-2.5 text-sm font-medium text-[#666] hover:border-blue-accent hover:text-blue-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={launch}
          className="bg-blue-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-accent-hover transition-colors">
          Launch
        </button>
        {msg && <span className={`text-xs ${msg.includes("saved") ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function SuppressedTab(_props: { campaignId: string }) {
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/suppressions`)
      .then(r => r.json())
      .then(data => setSuppressions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-muted-2">Loading...</div>;

  return (
    <div className="overflow-x-auto px-8 pb-6">
      {suppressions.length > 0 ? (
        <table className="w-full min-w-[400px] border-collapse">
          <thead>
            <tr>
              <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase w-[180px]">Email</th>
              <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Reason</th>
              <th className="pb-3 pt-6 text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase">Suppressed At</th>
            </tr>
          </thead>
          <tbody>
            {suppressions.map((s: any) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-4 text-sm font-medium text-ink">{s.email}</td>
                <td className="py-4 text-sm text-muted">{s.reason || "—"}</td>
                <td className="py-4 text-sm text-muted">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex items-center justify-center py-16 text-sm text-muted-2">No suppressed contacts</div>
      )}
    </div>
  );
}

function BouncesTab({ stats }: { stats: any }) {
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string>("date");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [viewLog, setViewLog] = useState<any>(null);
  const perPage = 15;

  const summary = stats?.bounceSummary || { total: 0, hardBounces: 0, softBounces: 0, unknownBounces: 0 };
  const reasons: any[] = stats?.bounceReasons || [];
  const leads: any[] = stats?.recentBouncedLeads || [];

  const filteredLeads = reasonFilter ? leads.filter(l => l.reason === reasonFilter) : leads;

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortCol === "leadEmail") cmp = a.leadEmail.localeCompare(b.leadEmail);
    else if (sortCol === "type") cmp = a.type.localeCompare(b.type);
    else if (sortCol === "reason") cmp = a.reason.localeCompare(b.reason);
    else if (sortCol === "step") cmp = a.step.localeCompare(b.step);
    return sortDir === "desc" ? -cmp : cmp;
  });

  const totalPages = Math.ceil(sortedLeads.length / perPage);
  const pagedLeads = sortedLeads.slice(page * perPage, (page + 1) * perPage);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  function SortIcon(col: string) {
    if (sortCol !== col) return null;
    return <span className="ml-1 text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  const cards = [
    { label: "Total bounces", value: summary.total, color: "text-ink" },
    { label: "Hard bounces", value: summary.hardBounces, color: "text-red-600" },
    { label: "Soft bounces", value: summary.softBounces, color: "text-yellow-600" },
    { label: "Unknown bounces", value: summary.unknownBounces, color: "text-muted" },
  ];

  return (
    <div className="px-8 pb-6 space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 pt-6">
        {cards.map(c => (
          <div key={c.label} className="bg-cream-2 border border-border rounded-lg px-5 py-4">
            <div className="text-xs text-muted mb-1">{c.label}</div>
            <div className={`text-[28px] font-bold tracking-tight ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Bounce reasons */}
      {reasons.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-ink mb-3">Bounce reasons</h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-cream-2">
                  <th className="text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase px-5 py-3">Reason</th>
                  <th className="text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase px-5 py-3">Count</th>
                  <th className="text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase px-5 py-3">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {reasons.map(r => (
                  <tr key={r.reason}
                    onClick={() => setReasonFilter(reasonFilter === r.reason ? null : r.reason)}
                    className={`border-t border-border cursor-pointer hover:bg-cream-2/50 transition-colors ${reasonFilter === r.reason ? "bg-blue-accent/10" : ""}`}>
                    <td className="px-5 py-3 text-sm text-ink">{r.reason}</td>
                    <td className="px-5 py-3 text-sm text-ink font-medium">{r.count}</td>
                    <td className="px-5 py-3 text-sm text-ink">{r.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reasonFilter && (
            <button onClick={() => setReasonFilter(null)} className="text-xs text-blue-accent mt-2 hover:underline">Clear filter</button>
          )}
        </div>
      )}

      {/* Recent bounced leads */}
      {leads.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-2">No bounces yet — your emails are landing safely!</div>
      ) : (
      <div>
        <h4 className="text-sm font-medium text-ink mb-3">Recent bounced leads</h4>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-cream-2">
                {[
                  { key: "date", label: "Date" },
                  { key: "leadEmail", label: "Lead" },
                  { key: "senderEmail", label: "Sender" },
                  { key: "step", label: "Step" },
                  { key: "type", label: "Type" },
                  { key: "reason", label: "Reason" },
                  { key: "status", label: "Status" },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase px-4 py-3 cursor-pointer hover:text-blue-accent select-none">
                    {col.label}{SortIcon(col.key)}
                  </th>
                ))}
                <th className="text-left text-[11px] font-semibold tracking-wider text-muted-2 uppercase px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {pagedLeads.map((l, i) => (
                <tr key={l.id} className={`border-t border-border ${i % 2 === 0 ? "bg-cream" : "bg-cream-2/30"} hover:bg-cream-2/70 transition-colors`}>
                  <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">{formatDateTime(l.date)}</td>
                  <td className="px-4 py-3 text-sm text-ink font-medium">{l.leadEmail}</td>
                  <td className="px-4 py-3 text-sm text-muted">{l.senderEmail}</td>
                  <td className="px-4 py-3 text-sm text-ink">{l.step}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      l.type === "hard_bounce" ? "bg-red-50 text-red-700" :
                      l.type === "soft_bounce" ? "bg-yellow-50 text-yellow-700" :
                      l.type === "auth_error" ? "bg-orange-50 text-orange-700" :
                      "bg-gray-50 text-gray-600"
                    }`}>
                      {l.type === "hard_bounce" ? "Hard bounce" :
                       l.type === "soft_bounce" ? "Soft bounce" :
                       l.type === "auth_error" ? "Auth error" : l.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{l.reason}</td>
                  <td className="px-4 py-3 text-sm text-muted font-mono">{l.status || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => setViewLog(l)} className="text-blue-accent hover:underline text-xs">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted">{sortedLeads.length} total</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="text-xs px-3 py-1.5 border border-border rounded hover:bg-cream-2 disabled:opacity-30 transition-colors">Previous</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`text-xs px-3 py-1.5 border border-border rounded transition-colors ${page === i ? "bg-ink text-white border-ink" : "hover:bg-cream-2"}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="text-xs px-3 py-1.5 border border-border rounded hover:bg-cream-2 disabled:opacity-30 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* View modal */}
      {viewLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setViewLog(null)}>
          <div className="bg-cream border border-border rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink">Bounce Details</h3>
              <button onClick={() => setViewLog(null)} className="text-muted-2 hover:text-blue-accent text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Lead</span><span className="text-ink">{viewLog.leadEmail}</span></div>
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Sender</span><span className="text-ink">{viewLog.senderEmail}</span></div>
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Step</span><span className="text-ink">{viewLog.step}</span></div>
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Type</span><span className="text-ink">{viewLog.type}</span></div>
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Reason</span><span className="text-ink">{viewLog.reason}</span></div>
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Status Code</span><span className="text-ink font-mono">{viewLog.status || "—"}</span></div>
              <div><span className="text-muted text-xs uppercase tracking-wider block mb-0.5">Date</span><span className="text-ink">{formatDateTime(viewLog.date)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


