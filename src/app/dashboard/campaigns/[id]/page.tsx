"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { VARIABLE_LIST, previewFillVariables } from "@/engine/personalize";
import DOMPurify from "dompurify";

import Select from "@/components/select";
import ConfirmModal from "@/components/confirm-modal";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/rich-text-editor";
import AiWriterWizard, { type GeneratedStep } from "@/components/ai-writer-wizard";
import { ArrowLeft02Icon } from "@/components/icons/arrow-left-02";
import VerificationStatusBadge from "@/components/verification-status-badge";
import { ChevronUpIcon } from "@/components/icons/chevron-up";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Cancel01Icon } from "@/components/icons/cancel-01";
import { EyeIcon } from "@/components/icons/eye";
import { FlashIcon } from "@/components/icons/flash";
import { SaveIcon } from "@/components/icons/save";
import { RefreshIcon } from "@/components/icons/refresh";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { MagicWand01Icon } from "@/components/icons/magic-wand-01";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Convert plain AI text into HTML that keeps paragraph structure. The AI
// contract (api/ai: "Use plain newlines to separate paragraphs") means each
// line is a paragraph, so each one becomes a real <p> block — <p> carries
// default vertical spacing in the rich editor and the email, giving clear
// gaps between paragraphs. Flattening everything to <br> made paragraphs
// look crammed together in the typing box. Blank lines / stray whitespace
// are dropped.
function textToEditorHtml(text: string): string {
  const escaped = escHtml(text);
  return escaped
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => `<p>${l}</p>`)
    .join("");
}
import { GridViewIcon } from "@/components/icons/grid-view";
import { CodeXmlIcon } from "@/components/icons/code-xml";
import { Link01Icon } from "@/components/icons/link-01";
import { Edit02Icon } from "@/components/icons/edit-02";
import { Clock01Icon } from "@/components/icons/clock-01";
import { PlusSignIcon } from "@/components/icons/plus-sign";
import { Search01Icon } from "@/components/icons/search-01";
import { FilterIcon } from "@/components/icons/filter";
import { Download01Icon } from "@/components/icons/download-01";
import { Mail01Icon } from "@/components/icons/mail-01";
import { SentIcon } from "@/components/icons/sent";
import { MailOpenIcon } from "@/components/icons/mail-open";
import { CursorPointer01Icon } from "@/components/icons/cursor-pointer-01";
import { ArrowUpLeft01Icon } from "@/components/icons/arrow-up-left-01";
import { CircleXIcon } from "@/components/icons/circle-x";
import { BoldIcon } from "@/components/icons/text-bold";
import { ItalicIcon } from "@/components/icons/text-italic";
import { UnderlineIcon } from "@/components/icons/text-underline";
import { StrikethroughIcon } from "@/components/icons/text-strike";

type CampaignState = "draft" | "active" | "paused" | "completed";
type Step = { id?: string; type: string; subject: string; bodyHtml: string; delayDays: number; delayUnit: string; order: number };

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(searchParams.get("tab") || "analytics");
  const [state, setState] = useState<CampaignState>("draft");
  const [steps, setSteps] = useState<Step[]>([{ type: "email", subject: "", bodyHtml: "", delayDays: 0, delayUnit: "days", order: 0 }]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStepIdx, setAiStepIdx] = useState(0);
  const [aiWriterOpen, setAiWriterOpen] = useState(false);
  const [aiDropdownStep, setAiDropdownStep] = useState<number | null>(null);
  const [spamCheck, setSpamCheck] = useState<{ stepIndex: number; score: number | null; findings: { flag: string; text: string; suggestion: string; fix: string }[]; applied: boolean[] } | null>(null);
  const [variablesPanelStep, setVariablesPanelStep] = useState<number | null>(null);
  const [previewStep, setPreviewStep] = useState<number | null>(null);
  const [senderEmail, setSenderEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [leadList, setLeadList] = useState<any[]>([]);
  const [varOverrides, setVarOverrides] = useState<Record<string, string>>({});
  const [testSending, setTestSending] = useState(false);
  const [deliverabilityScore, setDeliverabilityScore] = useState<number | null>(null);
  const [deliverabilityReasons, setDeliverabilityReasons] = useState<string[]>([]);
  const [contentScore, setContentScore] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState("");
  const [testMsgCode, setTestMsgCode] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [aiDropdownPos, setAiDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const editorRefs = useRef<(RichTextEditorHandle | null)[]>([]);

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

  function appendAiText(i: number, text: string) {
    const html = textToEditorHtml(text);
    const current = steps[i].bodyHtml || "";
    updateStep(i, "bodyHtml", current + (current ? "<br><br>" : "") + html);
  }

  function applyGeneratedSequence(genSteps: GeneratedStep[]) {
    const newSteps: Step[] = genSteps.map((s, i) => ({
      type: "email",
      subject: i === 0 ? s.subject || "" : "",
      bodyHtml: textToEditorHtml(s.body),
      delayDays: i === 0 ? 0 : 2,
      delayUnit: "days",
      order: i,
    }));
    setSteps(newSteps);
    setAiStepIdx(0);
    setTab("sequences");
  }

  async function runAi(action: string, stepIndex: number) {
    setAiStepIdx(stepIndex);
    setAiLoading(true);
    try {
      const step = steps[stepIndex];
      const stripHtml = (html: string) =>
        html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ");
      const body = step.bodyHtml ? stripHtml(step.bodyHtml).trim() : "";
      // Spam Check scans the body AND the subject (spam filters read both).
      // A "Subject:" anchor line keeps subject phrases physically distinct in
      // the combined text, and each fix is still just the matched words, so
      // Apply replaces them in whichever field actually contains them.
      const text = action === "spin"
        ? body || step.subject || ""
        : (body || step.subject || "")
            + (body && step.subject ? "\n\nSubject: " + step.subject : "");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, context: "outreach", campaignId: id, subject: step.subject || "" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "AI request failed. Please try again.");
        return;
      }
      if (data.result) {
        if (action === "spin") {
          updateStep(stepIndex, "bodyHtml", textToEditorHtml(data.result));
          if (data.subject) updateStep(stepIndex, "subject", data.subject);
          const shownCount = data.combined || data.comboEstimate;
          if (shownCount) {
            const shown = shownCount >= 1e12 ? "100B+" : Number(shownCount).toLocaleString();
            setToast(data.leadCount
              ? `Spintax: ~${shown} unique versions (subject + body) — covers your ${data.leadCount} leads`
              : `Spintax added — ~${shown} unique versions`);
            setTimeout(() => setToast(null), 4000);
          }
        } else if (action === "write") {
          appendAiText(stepIndex, data.result);
        } else if (action === "check") {
          const findings = Array.isArray(data.findings) ? data.findings : [];
          const score = typeof data.score === "number" ? data.score : null;
          if (findings.length > 0) {
            setSpamCheck({ stepIndex, score, findings, applied: findings.map(() => false) });
          } else {
            setToast(`Spam check passed — no spam-trigger words found${score !== null ? ` (${score}/10)` : ""}`);
            setTimeout(() => setToast(null), 4000);
          }
        }
      }
    } catch {
      alert("AI request failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
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
      setTestMsgCode(null);
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
    setSteps([...steps, { type: "email", subject: "", bodyHtml: "", delayDays: 0, delayUnit: "days", order: steps.length }]);
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, j) => j !== i));
  }

  function updateStep(i: number, field: string, val: any) {
    setSteps(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }

  // Replace every case-insensitive occurrence of `text` with `fix` ("" deletes
  // it) in a string. When deleting, also swallow exactly one neighbouring
  // space so "a free trial offer" → "a offer" doesn't happen; the resulting
  // double spaces / leading space are collapsed.
  function replaceAllInsensitive(input: string, text: string, fix: string): string {
    if (!text) return input;
    const lower = input.toLowerCase();
    const needle = text.toLowerCase();
    let out = "";
    let cursor = 0;
    while (true) {
      const idx = lower.indexOf(needle, cursor);
      if (idx === -1) { out += input.slice(cursor); break; }
      out += input.slice(cursor, idx) + fix;
      cursor = idx + text.length;
    }
    if (fix === "") {
      out = out.replace(/\s{2,}/g, " ").replace(/^\s+/, "").trim();
    }
    return out;
  }

  function applySpamFix(findingIdx: number) {
    if (!spamCheck) return;
    const { stepIndex, score, findings, applied } = spamCheck;
    const finding = findings[findingIdx];
    const step = steps[stepIndex];
    let nextSubject = step.subject || "";
    let nextBody = step.bodyHtml || "";
    let changed = false;
    // Apply only if the flagged words are actually present in that field.
    if (nextSubject.toLowerCase().includes(finding.text.toLowerCase())) {
      nextSubject = replaceAllInsensitive(nextSubject, finding.text, finding.fix);
      changed = true;
    }
    if (nextBody.toLowerCase().includes(finding.text.toLowerCase())) {
      nextBody = replaceAllInsensitive(nextBody, finding.text, finding.fix);
      changed = true;
    }
    if (changed) {
      updateStep(stepIndex, "subject", nextSubject);
      updateStep(stepIndex, "bodyHtml", nextBody);
      const nextApplied = applied.slice();
      nextApplied[findingIdx] = true;
      setSpamCheck({ stepIndex, score, findings, applied: nextApplied });
      setToast(`Fixed "${finding.text}"`);
      setTimeout(() => setToast(null), 2500);
    }
  }

  function moveStep(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps(prev => { const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }

  function insertVariable(i: number, field: "subject" | "bodyHtml", varKey: string) {
    const tag = `{{${varKey}}}`;
    navigator.clipboard.writeText(tag).then(() => {
      setToast("Copied " + tag);
      setTimeout(() => setToast(null), 2000);
    });
  }

  function formatStep(stepIdx: number, cmd: string) {
    editorRefs.current[stepIdx]?.exec(cmd);
  }

  function handleLink(stepIdx: number) {
    const url = prompt("Enter URL:", "https://");
    if (!url) return;
    editorRefs.current[stepIdx]?.exec("createLink", url);
  }

  function fillVariables(text: string): string {
    const lead = leadList.find(l => l.id === selectedLeadId) || null;
    return previewFillVariables(text || "", varOverrides, lead);
  }

  function getPreviewContent(stepIdx: number): string {
    return fillVariables(steps[stepIdx]?.bodyHtml || "");
  }

  async function sendTestEmail() {
    if (!recipientEmail?.includes("@")) { setTestMsg("Enter a valid recipient email"); return; }
    setTestSending(true); setTestMsg(""); setDeliverabilityScore(null); setDeliverabilityReasons([]); setContentScore(null);
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
        setTestMsgCode(null);
        if (data.deliverabilityScore) setDeliverabilityScore(data.deliverabilityScore);
      } else {
        setTestMsg(data.error || "Failed to send test email");
        setTestMsgCode(data.code || null);
      }
    } catch (e: any) {
      setTestMsg(`Error: ${e.message}`);
      setTestMsgCode(null);
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
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all">
          {toast}
        </div>
      )}
      <header className="px-6 lg:px-10 pt-6 pb-0">
        <Link href="/dashboard/campaigns" className="text-sm text-muted hover:text-blue-accent flex items-center gap-1.5 mb-4">
          <ArrowLeft02Icon size={14} />
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
              <div className="w-28 shrink-0">
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
                          <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-muted-2 hover:text-blue-accent disabled:opacity-20"><ChevronUpIcon size={10} /></button>
                          <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="text-muted-2 hover:text-blue-accent disabled:opacity-20"><ChevronDownIcon size={10} /></button>
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
                          <ChevronUpIcon size={14} />
                        </button>
                        <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                          className="text-muted-2 hover:text-blue-accent disabled:opacity-20 p-1.5 rounded-lg hover:bg-cream-2/60 transition-all" title="Move down">
                          <ChevronDownIcon size={14} />
                        </button>
                        <div className="w-px h-4 bg-border/40 mx-1"></div>
                        <button onClick={() => removeStep(i)} className="text-muted-2 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all" title="Remove step">
                          <Cancel01Icon size={14} />
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
                            {i === 0 ? (
                              <input value={step.subject} onChange={e => updateStep(i, "subject", e.target.value)}
                                placeholder="Your subject"
                                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted-2/40 min-w-0" />
                            ) : (
                              <>
                                <div className="flex-1 text-sm text-blue-accent/70 truncate min-w-0" title="Leave empty to use the previous step&apos;s subject — follow-ups always reuse it and send threading headers so they stay in the same conversation.">
                                  Leave empty to use previous step&apos;s subject
                                </div>
                                <span className="text-[10px] font-mono text-blue-accent/60 bg-blue-light/30 px-2 py-0.5 rounded-full shrink-0">thread</span>
                              </>
                            )}
                            <div className="w-px h-5 bg-border/40 shrink-0"></div>
                            <button onClick={() => setPreviewStep(i)}
                              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-blue-accent px-2.5 py-1.5 rounded-lg hover:bg-blue-light/40 transition-all shrink-0">
                              <EyeIcon size={14} />
                              Preview
                            </button>
                            <button onClick={() => { setAiStepIdx(i); setShowTemplates(true); loadTemplates(); }}
                              className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-blue-light/40 transition-all shrink-0">
                              <FlashIcon size={15} />
                            </button>
                          </div>

                          {/* Body area */}
                          <div className="flex min-h-[260px] relative">
                            <RichTextEditor
                              ref={(el) => { editorRefs.current[i] = el; }}
                              value={step.bodyHtml}
                              onChange={html => updateStep(i, "bodyHtml", html)}
                              placeholder="Start typing here…"
                              className="flex-1 border-0 outline-none text-sm text-ink leading-relaxed px-5 py-[18px] placeholder:text-muted-2/35 bg-transparent"
                            />
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
                          <div className="flex items-center gap-0.5 px-3 py-2 border-t border-border/30 bg-cream-2/30 overflow-x-auto">
                            <button onClick={saveSteps} disabled={saving}
                              className="flex items-center gap-1.5 bg-blue-accent hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-[0_1px_2px_0_rgba(0,0,0,0.06)] whitespace-nowrap">
                              <SaveIcon size={13} />
                              {saving ? "Saving…" : "Save"}
                            </button>

                            <div className="w-px h-5 bg-border/40 shrink-0 mx-1.5"></div>

                              <div className="relative">
                              <button onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setAiDropdownPos({ top: rect.bottom + 4, left: rect.left }); setAiDropdownStep(aiDropdownStep === i ? null : i); }}
                                className="flex items-center gap-1.5 text-xs text-muted hover:text-blue-accent px-2.5 py-1.5 rounded-lg hover:bg-white/70 transition-all">
                                <FlashIcon size={14} />
                                AI Tools
                              </button>
                              {aiDropdownStep === i && (
                                <div className="fixed w-44 bg-white border border-border/50 rounded-xl shadow-lg z-[200] py-1.5" style={{ top: aiDropdownPos.top, left: aiDropdownPos.left }}>
                                  <button onClick={() => { setAiDropdownStep(null); setAiStepIdx(i); runAi("spin", i); }}
                                    disabled={aiLoading} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-muted hover:text-blue-accent hover:bg-cream-2/60 transition-all disabled:opacity-30">
                                    <RefreshIcon size={14} />
                                    AI Spin Tax
                                  </button>
                                  <button onClick={() => { setAiDropdownStep(null); setAiStepIdx(i); runAi("check", i); }}
                                    disabled={aiLoading} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-muted hover:text-blue-accent hover:bg-cream-2/60 transition-all disabled:opacity-30">
                                    <CircleCheckIcon size={14} />
                                    Spam Check
                                  </button>
                                  <button onClick={() => { setAiDropdownStep(null); setAiStepIdx(i); setAiWriterOpen(true); }}
                                    disabled={aiLoading} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-muted hover:text-blue-accent hover:bg-cream-2/60 transition-all disabled:opacity-30">
                                    <MagicWand01Icon size={14} />
                                    AI Writer
                                  </button>
                                </div>
                              )}
                            </div>
                            <button onClick={() => { setAiStepIdx(i); setShowTemplates(true); loadTemplates(); }}
                              className="flex items-center gap-1.5 text-xs text-muted hover:text-blue-accent px-2.5 py-1.5 rounded-lg hover:bg-white/70 transition-all">
                              <GridViewIcon size={14} />
                              Templates
                            </button>

                            <button onClick={e => { e.stopPropagation(); setVariablesPanelStep(variablesPanelStep === i ? null : i); }}
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${variablesPanelStep === i ? "text-blue-accent bg-blue-light/40" : "text-muted hover:text-blue-accent hover:bg-white/70"}`}>
                              <CodeXmlIcon size={14} />
                              Variables
                            </button>

                            <div className="flex-1"></div>

                            <div className="flex items-center gap-0.5">
                              <button onMouseDown={e => e.preventDefault()} onClick={() => formatStep(i, "bold")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Bold">
                                <BoldIcon size={14} />
                              </button>
                              <button onMouseDown={e => e.preventDefault()} onClick={() => formatStep(i, "italic")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Italic">
                                <ItalicIcon size={14} />
                              </button>
                              <button onMouseDown={e => e.preventDefault()} onClick={() => formatStep(i, "underline")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Underline">
                                <UnderlineIcon size={14} />
                              </button>
                              <button onMouseDown={e => e.preventDefault()} onClick={() => formatStep(i, "strikeThrough")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Strikethrough">
                                <StrikethroughIcon size={14} />
                              </button>
                            </div>

                            <div className="w-px h-5 bg-border/40 shrink-0 mx-0.5"></div>

                            <div className="flex items-center gap-0.5">
                              <button onMouseDown={e => e.preventDefault()} onClick={() => handleLink(i)} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Link">
                                <Link01Icon size={14} />
                              </button>
                              <button onClick={() => insertVariable(i, "bodyHtml", "accountSignature")} className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Signature">
                                <Edit02Icon size={14} />
                              </button>
                            </div>

                            <div className="w-px h-5 bg-border/40 shrink-0 mx-0.5"></div>

                            <button className="text-muted-3 hover:text-blue-accent p-1.5 rounded-lg hover:bg-white/70 transition-all" title="Source">
                              <CodeXmlIcon size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Delay — only for follow-ups */}
                        {i > 0 && (
                          <div className="flex items-center gap-2.5 flex-wrap bg-cream-2/40 border border-border/30 rounded-xl px-5 py-3.5 mt-3">
                            <Clock01Icon size={15} className="text-muted-2 shrink-0" />
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
              <PlusSignIcon size={16} />
              {steps.length === 0 ? "Add a step" : "Add Follow-up Step"}
            </button>
          </div>
        )}

        {/* Test Email Modal */}
        {previewStep !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPreviewStep(null)}>
            <div className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] w-full max-w-[780px] max-h-[90vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                <h2 className="text-xl font-bold text-[#1a1a1a]">Test Email</h2>
                <button onClick={() => setPreviewStep(null)} className="text-gray-400 hover:text-gray-600 flex items-center justify-center">
                  <Cancel01Icon size={18} />
                </button>
              </div>

              {/* Body - two columns */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                      <Select value={selectedLeadId} onChange={setSelectedLeadId}
                        options={[{ value: "", label: "Select a lead..." }, ...leadList.map(l => ({ value: l.id, label: `${l.firstName || l.email} ${l.lastName || ""}` }))]}
                        placeholder="Select a lead..."
                        triggerClassName="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent transition-colors bg-transparent text-left"
                        matchWidth
                      />
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
                              {fillVariables(steps[previewStep]?.subject || "") || (previewStep > 0 ? "Leave empty to use previous step's subject" : "(no subject)")}
                            </div>
                            <div className="text-sm leading-relaxed html-preview" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreviewContent(previewStep)) }} />
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
                  <div className={`mt-4 text-sm px-4 py-2.5 rounded-lg ${testMsg.includes("successfully") ? "bg-green-50 text-green-700 border border-green-200" : testMsgCode === "SEND_PAUSED" ? "bg-[#E3EBFD] text-[#2563EB] border border-[#C8D8FC]" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {testMsg}
                  </div>
                )}
                {deliverabilityScore !== null && (
                  <div className="mt-3 text-sm text-[#666] flex items-center gap-2">
                    <span>Deliverability Score:</span>
                    <span className={`font-semibold ${deliverabilityScore >= 7 ? "text-green-600" : deliverabilityScore >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                      {deliverabilityScore}/10
                    </span>
                    {contentScore !== null && (
                      <span className="text-xs text-[#999]">(AI content: {contentScore}/10)</span>
                    )}
                  </div>
                )}
                {deliverabilityReasons.length > 0 && (
                  <div className="mt-2 text-xs leading-relaxed">
                    {deliverabilityReasons.map((r, i) => (
                      <div key={i} className={r.startsWith("Content") || r.includes("flagged") ? "text-red-600" : "text-[#999]"}>
                        • {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200">
                <button disabled={testSending} onClick={async () => {
setTestMsg(""); setTestMsgCode(null); setDeliverabilityScore(null); setDeliverabilityReasons([]); setContentScore(null);
                  try {
                    const res = await fetch("/api/deliverability", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ campaignId: id }),
                    });
                    const data = await res.json();
                    if (data.score !== undefined) {
                      setDeliverabilityScore(data.score);
                      setDeliverabilityReasons(data.reasons || []);
                      setContentScore(typeof data.contentScore === "number" ? data.contentScore : null);
                    }
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
                <button onClick={() => setShowTemplates(false)} className="text-muted-2 hover:text-blue-accent flex items-center justify-center">
                  <Cancel01Icon size={18} />
                </button>
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
        
        <AiWriterWizard
          open={aiWriterOpen}
          campaignId={id}
          onClose={() => setAiWriterOpen(false)}
          onGenerated={applyGeneratedSequence}
        />

        {/* Spam Check Modal */}
        {spamCheck && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSpamCheck(null)}>
            <div className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] w-full max-w-[640px] max-h-[85vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[#1a1a1a]">Spam Check</h2>
                  {spamCheck.score !== null && (
                    <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${spamCheck.score >= 7 ? "bg-green-50 text-green-700" : spamCheck.score >= 4 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-600"}`}>
                      AI score {spamCheck.score}/10
                    </span>
                  )}
                </div>
                <button onClick={() => setSpamCheck(null)} className="text-gray-400 hover:text-gray-600 flex items-center justify-center">
                  <Cancel01Icon size={18} />
                </button>
              </div>

              {/* Findings */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <p className="text-sm text-[#666]">Found {spamCheck.findings.length} issue{spamCheck.findings.length !== 1 ? "s" : ""}. Apply a fix to swap every occurrence in this email — or reword it yourself.</p>
                {spamCheck.findings.map((f, i) => (
                  <div key={i} className={`border rounded-xl p-4 ${spamCheck.applied[i] ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{f.flag}</div>
                        <div className="text-sm font-semibold text-[#1a1a1a] break-words mb-1">&ldquo;{f.text}&rdquo;</div>
                        <div className="text-sm text-[#555] leading-relaxed">{f.suggestion}</div>
                      </div>
                      <button
                        onClick={() => applySpamFix(i)}
                        disabled={spamCheck.applied[i]}
                        className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          spamCheck.applied[i]
                            ? "bg-green-100 text-green-700 cursor-default"
                            : "bg-blue-accent text-white hover:bg-blue-accent/90"
                        }`}
                      >
                        {spamCheck.applied[i] ? "Fixed ✓" : "Apply fix"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-gray-200">
                <button onClick={() => setSpamCheck(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                  {spamCheck.applied.some(Boolean) ? "Done" : "Close"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function LeadsTab({ campaignId }: { campaignId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [verifyResult, setVerifyResult] = useState<{ error?: string; valid?: number; invalid?: number; risky?: number; catch_all?: number; unknown?: number } | null>(null);

  function getProviderName(email: string, dbProvider?: string): string {
    if (dbProvider && dbProvider !== "Unknown") return dbProvider;
    const domain = email.split("@")[1]?.toLowerCase() || "";
    if (domain === "gmail.com" || domain === "googlemail.com") return "Google";
    if (domain === "yahoo.com" || domain === "ymail.com" || domain === "rocketmail.com") return "Yahoo";
    if (domain === "hotmail.com" || domain === "outlook.com" || domain === "live.com" || domain === "hotmail.co.uk") return "Microsoft";
    if (domain === "aol.com") return "AOL";
    if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return "Apple";
    if (domain === "protonmail.com" || domain === "proton.me" || domain === "pm.me") return "ProtonMail";
    if (domain === "zoho.com") return "Zoho";
    if (domain === "gmx.com" || domain === "gmx.de" || domain === "gmx.net") return "GMX";
    if (domain === "mail.ru" || domain === "inbox.ru" || domain === "list.ru") return "Mail.ru";
    if (domain === "yandex.com" || domain === "yandex.ru") return "Yandex";
    if (domain === "fastmail.com" || domain === "fastmail.fm") return "Fastmail";
    if (domain === "tutanota.com" || domain === "tutamail.com") return "Tutanota";
    if (domain === "163.com") return "163";
    if (domain === "126.com") return "126";
    if (domain === "web.de") return "Web.de";
    if (domain === "t-online.de") return "T-Online";
    if (domain === "freenet.de") return "Freenet";
    if (domain === "free.fr") return "Free";
    if (domain === "orange.fr") return "Orange";
    if (domain === "laposte.net") return "La Poste";
    if (domain === "sfr.fr") return "SFR";
    if (domain === "qq.com") return "QQ";
    if (domain === "naver.com") return "Naver";
    if (domain === "daum.net") return "Daum";
    if (domain === "rediffmail.com") return "Rediffmail";
    if (domain === "indiatimes.com") return "Indiatimes";
    if (domain === "rambler.ru") return "Rambler";
    if (domain === "uol.com.br") return "UOL";
    if (domain === "bol.com.br") return "BOL";
    if (domain === "hey.com") return "Hey";
    if (domain === "hushmail.com") return "Hushmail";
    if (domain === "startmail.com") return "StartMail";
    if (domain === "posteo.de") return "Posteo";
    if (domain === "mailbox.org") return "Mailbox.org";
    if (domain === "netzero.com" || domain === "netzero.net") return "NetZero";
    if (domain === "juno.com") return "Juno";
    if (domain === "lycos.com") return "Lycos";
    if (domain === "excite.com") return "Excite";
    if (domain === "mailfence.com") return "Mailfence";
    if (domain === "runbox.com") return "Runbox";
    if (domain === "countermail.com") return "CounterMail";
    return dbProvider || "Other";
  }

  const PROVIDER_LOGO: Record<string, string | undefined> = {
    Google: "/provider-logos/gmail.png",
    Gmail: "/provider-logos/gmail.png",
    Yahoo: "/provider-logos/yahoo.png",
    Microsoft: "/provider-logos/outlook.png",
    Outlook: "/provider-logos/outlook.png",
    AOL: "/provider-logos/aol.png",
    Apple: "/provider-logos/apple.png",
    iCloud: "/provider-logos/apple.png",
    ProtonMail: "/provider-logos/proton.png",
    Proton: "/provider-logos/proton.png",
    Zoho: "/provider-logos/zoho.png",
    GMX: "/provider-logos/gmx.png",
    "Mail.ru": "/provider-logos/mailru.png",
    "Mail.com": "/provider-logos/mail.png",
    Yandex: "/provider-logos/yandex.png",
    Fastmail: "/provider-logos/fastmail.png",
    Tutanota: "/provider-logos/tutanota.png",
    "163": "/provider-logos/163.png",
    "126": "/provider-logos/126.png",
    "Web.de": "/provider-logos/webde.png",
    "T-Online": "/provider-logos/tonline.png",
    Freenet: "/provider-logos/freenet.png",
    Free: "/provider-logos/free.png",
    Orange: "/provider-logos/orange.png",
    "La Poste": "/provider-logos/laposte.png",
    SFR: "/provider-logos/sfr.png",
    QQ: "/provider-logos/qq.png",
    Naver: "/provider-logos/naver.png",
    Daum: "/provider-logos/daum.png",
    Rediffmail: "/provider-logos/rediff.png",
    Indiatimes: "/provider-logos/indiatimes.png",
    Rambler: "/provider-logos/rambler.png",
    UOL: "/provider-logos/uol.png",
    BOL: "/provider-logos/bol.png",
    Hey: "/provider-logos/hey.png",
    Hushmail: "/provider-logos/hushmail.png",
    StartMail: "/provider-logos/startmail.png",
    Posteo: "/provider-logos/posteo.png",
    "Mailbox.org": "/provider-logos/mailbox.png",
    NetZero: "/provider-logos/netzero.png",
    Juno: "/provider-logos/juno.png",
    Lycos: "/provider-logos/lycos.png",
    Excite: "/provider-logos/excite.png",
    Mailfence: "/provider-logos/mailfence.png",
    Runbox: "/provider-logos/runbox.png",
    CounterMail: "/provider-logos/countermail.png",
  };

  function getProviderBadge(provider: string) {
    const logo = PROVIDER_LOGO[provider];
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-ink bg-white border border-border">
        {logo ? (
          <img src={logo} alt="" className="w-3.5 h-3.5 rounded-full object-contain" />
        ) : null}
        {provider}
      </span>
    );
  }
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
  async function handleVerifyAll() {
    setVerifying(true);
    setVerifyResult(null);
    setVerifyingIds(new Set(leads.map(l => l.id)));
    try {
      const res = await fetch("/api/leads/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const result = await res.json();
      setVerifyResult(result);
      const fresh = await fetch(`/api/leads?campaignId=${campaignId}`).then(r => r.json());
      setLeads(Array.isArray(fresh) ? fresh : []);
    } catch {
      setVerifyResult({ error: "Verification failed" });
    } finally {
      setVerifying(false);
      setVerifyingIds(new Set());
    }
  }
  const customKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const l of leads) {
      if (l.customFields) {
        try { Object.keys(JSON.parse(l.customFields)).forEach(k => { const c = k.toLowerCase().replace(/[^\w]/g,""); if (c !== "email" && c !== "emailaddress" && c !== "e-mail" && c !== "emails") keys.add(k); }); } catch {}
      }
    }
    return Array.from(keys);
  }, [leads]);
  if (loading) return <div className="text-sm text-muted py-8">Loading...</div>;
  if (leads.length === 0) return <div className="empty-state"><h3>Add some leads to get started</h3><p>Import a CSV or paste a list to add leads to this campaign.</p><Link href={`/dashboard/leads?campaignId=${campaignId}`} className="btn btn-primary">Import Leads</Link></div>;
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted">{leads.length} leads</p>
        <div className="flex gap-2">
          <button onClick={handleVerifyAll} disabled={verifying} className="btn btn-ghost btn-sm text-blue-accent hover:text-blue-accent disabled:opacity-40">
            {verifying ? "Verifying..." : "Verify All"}
          </button>
          <button onClick={() => setShowConfirmAll(true)} className="btn btn-ghost btn-sm text-red-600 hover:text-red-600">Delete All</button>
        </div>
      </div>
      {verifyResult && !verifyResult.error && (
        <div className="text-sm p-3 rounded-lg mb-4 bg-blue-50 text-blue-700">
          Verified: {verifyResult.valid} valid, {(verifyResult.invalid || 0) + (verifyResult.risky || 0)} do not contact, {verifyResult.catch_all || 0} catch-all, {verifyResult.unknown || 0} unknown
        </div>
      )}
      {verifyResult?.error && (
        <div className="text-sm p-3 rounded-lg mb-4 bg-red-50 text-red-700">{verifyResult.error}</div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th className="w-10">#</th>
            <th>Email</th>
            <th>Provider</th>
            {customKeys.length > 0 ? (
              customKeys.map(k => <th key={k}>{k}</th>)
            ) : (
              <th>Name</th>
            )}
            <th>Status</th><th>Verification</th><th></th>
          </tr></thead>
          <tbody>{leads.map((l: any, i: number) => {
            let parsed: Record<string, string> = {};
            if (l.customFields) { try { parsed = JSON.parse(l.customFields); } catch {} }
            return (
              <tr key={l.id}>
                <td className="text-muted text-xs">{i + 1}</td>
                <td className="font-medium">{l.email}</td>
                <td className="text-muted text-xs">{getProviderBadge(getProviderName(l.email, l.provider))}</td>
                {customKeys.length > 0 ? (
                  customKeys.map(k => <td key={k} className="text-muted">{parsed[k] || ""}</td>)
                ) : (
                  <td>{[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}</td>
                )}
                <td><span className={`badge ${l.status === "replied" ? "active" : l.status === "completed" ? "completed" : ""}`}>{l.status}</span></td>
                <td>
                  <VerificationStatusBadge status={l.verificationStatus} verifying={verifyingIds.has(l.id)} />
                </td>
                <td><button onClick={() => handleRemove(l.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button></td>
              </tr>
            );
          })}</tbody>
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

    // Auto-refresh every 30 seconds regardless of status — a draft campaign
    // can still have leads/events (e.g. a manual test send, or leads that
    // were already imported), and the data table should reflect that live
    // without requiring the campaign to be launched first.
    const interval = setInterval(fetchStats, 30_000);

    return () => { active = false; if (interval) clearInterval(interval); };
  }, [campaignId, state]);

  function toggleVariant(key: string) {
    setVariantToggles(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) return <div className="text-center text-muted py-16 text-sm">Loading...</div>;

  const s = stats?.summary || {};
  const d = stats?.detailed || {};
  const campaignData = stats?.campaigns?.[0] || {};
  const openTrackingEnabled = campaignData.openTracking === true;
  const clickTrackingEnabled = campaignData.clickTracking === true;
  const steps: any[] = stats?.stepAnalytics?.[0]?.steps || [];
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
        <div className="flex items-center border-b border-border px-4 sm:px-8 pt-6">
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto flex-1 min-w-0">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setAnalyticsTab(tab)}
                className={`relative pb-4 text-sm font-medium transition-colors whitespace-nowrap ${analyticsTab === tab ? "text-blue-accent" : "text-muted hover:text-blue-accent"}`}>
                {tab}
                {analyticsTab === tab && <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-blue-accent" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-4 shrink-0 ml-4">
            {state === "active" ? (
              <button onClick={onPause} className="btn btn-ghost btn-xs">Pause</button>
            ) : state === "draft" ? (
              <button onClick={onResume} className="btn btn-primary btn-xs">Launch</button>
            ) : state === "paused" ? (
              <button onClick={onResume} className="btn btn-primary btn-xs">Resume</button>
            ) : (
              <span className="text-xs text-muted-2 font-medium">Completed</span>
            )}
          </div>
        </div>

        {/* Step Analytics */}
        {analyticsTab === "Step Analytics" && (
          <div className="overflow-x-auto px-4 sm:px-8 pb-6">
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
        {analyticsTab === "Activity" && <ActivityFeedTab campaignId={campaignId} />}


        {/* Bounces */}
        {analyticsTab === "Bounces" && <BouncesTab stats={stats} />}

        {/* Suppressed */}
        {analyticsTab === "Suppressed" && <SuppressedTab campaignId={campaignId} />}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffMon = Math.floor(diffDay / 30);
  return `${diffMon} month${diffMon === 1 ? "" : "s"} ago`;
}

const ACTIVITY_TYPE_META: Record<string, { label: string; color: string; bg: string; icon: ReactNode }> = {
  sent: {
    label: "Sent", color: "#2563EB", bg: "rgba(37,99,235,0.1)",
    icon: <SentIcon size={14} />,
  },
  opened: {
    label: "Opened", color: "#7C3AED", bg: "rgba(124,58,237,0.1)",
    icon: <MailOpenIcon size={14} />,
  },
  clicked: {
    label: "Clicked", color: "#D97706", bg: "rgba(217,119,6,0.1)",
    icon: <CursorPointer01Icon size={14} />,
  },
  replied: {
    label: "Replied", color: "#16A34A", bg: "rgba(22,163,74,0.1)",
    icon: <ArrowUpLeft01Icon size={14} />,
  },
  bounced: {
    label: "Bounce", color: "#DC2626", bg: "rgba(220,38,38,0.1)",
    icon: <CircleXIcon size={14} />,
  },
};

function ActivityFeedTab({ campaignId }: { campaignId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const PAGE_SIZE = 50;

  // Debounce the search box so we're not firing a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/campaigns/activity?campaignId=${campaignId}&search=${encodeURIComponent(search)}&type=${typeFilter}&offset=0&limit=${PAGE_SIZE}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setHasMore(Boolean(data.hasMore));
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campaignId, search, typeFilter]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/campaigns/activity?campaignId=${campaignId}&search=${encodeURIComponent(search)}&type=${typeFilter}&offset=${items.length}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      setItems(prev => [...prev, ...(Array.isArray(data.items) ? data.items : [])]);
      setHasMore(Boolean(data.hasMore));
    } catch {}
    setLoadingMore(false);
  }

  async function downloadCsv() {
    const res = await fetch(`/api/campaigns/activity?campaignId=${campaignId}&search=${encodeURIComponent(search)}&type=${typeFilter}&offset=0&limit=5000`);
    const data = await res.json();
    const rows: any[] = Array.isArray(data.items) ? data.items : [];
    const header = ["Type", "Lead Email", "Sending Account", "Step", "Date"];
    const csvLines = [
      header.join(","),
      ...rows.map(r => [
        ACTIVITY_TYPE_META[r.type]?.label || r.type,
        r.leadEmail,
        r.senderEmail,
        r.step ? `Step ${r.step}` : "",
        new Date(r.date).toISOString(),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const typeOptions = [
    { value: "all", label: "All activity" },
    { value: "sent", label: "Sent" },
    { value: "opened", label: "Opened" },
    { value: "clicked", label: "Clicked" },
    { value: "replied", label: "Replied" },
    { value: "bounced", label: "Bounced" },
  ];

  return (
    <div className="px-4 sm:px-8 pb-6">
      {/* Search + filter + export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-6 pb-4">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2">
            <Search01Icon size={14} />
          </span>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by email"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-transparent text-ink placeholder:text-muted-2 focus:outline-none focus:border-blue-accent"
          />
        </div>
        <div className="relative">
          <button onClick={() => setFilterOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border ${typeFilter !== "all" ? "border-blue-accent text-blue-accent" : "border-border text-muted"}`}>
            <FilterIcon size={14} />
            Filter{typeFilter !== "all" ? `: ${ACTIVITY_TYPE_META[typeFilter]?.label || typeFilter}` : ""}
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-border rounded-md shadow-lg z-20 py-1">
                {typeOptions.map(opt => (
                  <button key={opt.value} onClick={() => { setTypeFilter(opt.value); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-cream-2 ${typeFilter === opt.value ? "text-blue-accent font-medium" : "text-ink"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={downloadCsv} title="Export CSV" className="p-2 rounded-md border border-border text-muted hover:text-blue-accent hover:border-blue-accent">
          <Download01Icon size={14} />
        </button>
        <div className="flex-1" />
        <span className="text-xs text-muted-2">{total} event{total === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-2">Loading...</div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-2">No activity yet</div>
      ) : (
        <div>
          {items.map((item, i) => {
            const meta = ACTIVITY_TYPE_META[item.type] || ACTIVITY_TYPE_META.sent;
            return (
              <div key={item.id} className={`flex items-center gap-4 py-3.5 ${i > 0 ? "border-t border-dashed border-border" : ""}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </div>
                <div className="w-20 shrink-0">
                  <div className="text-sm font-semibold text-ink">{meta.label}</div>
                  <div className="text-[11px] text-muted-2 truncate max-w-[140px]">{item.senderEmail}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-muted-2 shrink-0">
                    <Mail01Icon size={13} />
                  </span>
                  <span className="text-sm text-ink truncate">{item.leadEmail}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-2 shrink-0 w-36">
                  <Clock01Icon size={12} />
                  {timeAgo(item.date)}
                </div>
                <div className="text-xs text-muted-2 shrink-0 w-14 text-right">{item.step ? `Step ${item.step}` : ""}</div>
              </div>
            );
          })}
          {hasMore && (
            <div className="flex justify-center pt-6">
              <button onClick={loadMore} disabled={loadingMore} className="btn btn-ghost btn-sm">
                {loadingMore ? "Loading..." : `Load ${PAGE_SIZE} more`}
              </button>
            </div>
          )}
        </div>
      )}
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
      const res = await fetch(`/api/campaigns?id=${campaignId}`, {
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
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        setMsg(`Failed to save: ${err.slice(0, 150) || res.status}`);
        setSaving(false);
        return;
      }
      // Re-fetch and re-sync local state from what's actually in the DB now
      const fresh = await fetch(`/api/campaigns?id=${campaignId}`).then(r => r.json()).catch(() => null);
      if (fresh?.schedules) {
        setSchedules(fresh.schedules.map((s: any) => ({
          id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime,
          timezone: s.timezone || "America/New_York",
          days: typeof s.days === "string" ? JSON.parse(s.days) : s.days,
        })));
      }
      setMsg("Schedule saved");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) {
      setMsg(`Failed to save: ${e?.message || "network error"}`);
    }
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
                { value: "Africa/Lagos", label: "West Africa Time (WAT)" },
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
  const [rampStart, setRampStart] = useState<string | null>(null);
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
        setRampStart(camp.rampStart ?? null);
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
          rampStart: slowRamp ? (rampStart || new Date().toISOString()) : null,
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
      // Re-sync from the real saved values instead of trusting the local
      // state — surfaces immediately if anything didn't actually persist.
      const fresh = await fetch(`/api/campaigns?id=${campaignId}`).then(r => r.json()).catch(() => null);
      if (fresh) {
        setDailySendLimit(fresh.dailySendLimit ?? dailySendLimit);
        setMinTimeBetween(fresh.minTimeBetween ?? minTimeBetween);
        setRandomExtraTime(fresh.randomExtraTime ?? randomExtraTime);
        setStopOnReply(fresh.stopOnReply ?? stopOnReply);
        setOpenTracking(fresh.openTracking ?? openTracking);
        setClickTracking(fresh.clickTracking ?? clickTracking);
        setSlowRamp(fresh.slowRamp ?? slowRamp);
        setRampStart(fresh.rampStart ?? rampStart);
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
              className="w-full flex items-center justify-between border border-[#ddd] rounded-lg px-3 py-2.5 text-sm text-left bg-white hover:border-blue-accent transition-colors min-h-[42px]">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {selected.length === 0 ? (
                  <span className="text-[#999]">Select accounts</span>
                ) : (
                  selected.map(id => {
                    const acct = accounts.find(a => a.id === id);
                    if (!acct) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-cream-2 border border-border rounded-md px-2 py-0.5 text-xs text-ink">
                        {acct.email}
                        <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); setSelected(prev => prev.filter(x => x !== id)); }}
                          className="text-muted-2 hover:text-ink ml-0.5 cursor-pointer">
                          <Cancel01Icon size={12} />
                        </span>
                      </span>
                    );
                  })
                )}
              </div>
              <ChevronDownIcon size={16} className={`text-[#666] transition-transform flex-shrink-0 ml-2 ${accountsOpen ? "rotate-180" : ""}`} />
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
        <ChevronDownIcon size={12} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
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

function SuppressedTab({ campaignId }: { campaignId: string }) {
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads?campaignId=${campaignId}`).then(r => r.json()),
      fetch(`/api/suppressions`).then(r => r.json()),
    ]).then(([leadsData, suppData]) => {
      const leadEmails = new Set((Array.isArray(leadsData) ? leadsData : []).map((l: any) => l.email.toLowerCase()));
      const allSupps = Array.isArray(suppData) ? suppData : [];
      setSuppressions(allSupps.filter((s: any) => leadEmails.has(s.email.toLowerCase())));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-muted-2">Loading...</div>;

  return (
    <div className="overflow-x-auto px-4 sm:px-8 pb-6">
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
    return <span className="ml-1 inline-flex align-middle">{sortDir === "asc" ? <ChevronUpIcon size={10} /> : <ChevronDownIcon size={10} />}</span>;
  }

  const cards = [
    { label: "Total bounces", value: summary.total, color: "text-ink" },
    { label: "Hard bounces", value: summary.hardBounces, color: "text-red-600" },
    { label: "Soft bounces", value: summary.softBounces, color: "text-yellow-600" },
    { label: "Unknown bounces", value: summary.unknownBounces, color: "text-muted" },
  ];

  return (
    <div className="px-4 sm:px-8 pb-6 space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
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
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
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
              <button onClick={() => setViewLog(null)} className="text-muted-2 hover:text-blue-accent flex items-center justify-center">
                <Cancel01Icon size={18} />
              </button>
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


