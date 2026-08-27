"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import ReconnectModal from "@/components/reconnect-modal";
import { ChevronLeftIcon } from "@/components/icons/chevron-left";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { ChevronUpIcon } from "@/components/icons/chevron-up";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { CircleXIcon } from "@/components/icons/circle-x";
import { BoldIcon } from "@/components/icons/text-bold";
import { ItalicIcon } from "@/components/icons/text-italic";
import { UnderlineIcon } from "@/components/icons/text-underline";
import { TextColorIcon } from "@/components/icons/text-color";
import { CodeXmlIcon } from "@/components/icons/code-xml";

const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

const TABS = [
  { key: "warmup", label: "Warmup" },
  { key: "settings", label: "Settings" },
];

export default function EmailAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const email = decodeURIComponent(params.id as string);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("warmup");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const sigRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-accounts");
      const accounts = await res.json();
      if (!Array.isArray(accounts)) return;
      const account = accounts.find((a: any) => a.email === email);
      if (!account) return;
      const detailRes = await fetch(`/api/email-accounts?id=${account.id}&detail=true`);
      const detail = await detailRes.json();
      setData(detail);
      const [first, last] = splitName(detail.account.displayName || "");
      setSettings({
        firstName: first,
        lastName: last,
        signature: detail.account.signature || "",
        filterTag: detail.account.warmupFilterTag || "",
        increasePerDay: detail.account.warmupIncrease ?? 1,
        dailyLimit: detail.account.warmupMax ?? 10,

        disableSlowWarmup: detail.account.disableSlowWarmup ?? false,
        replyRate: detail.account.warmupReplyRate ?? 30,
        weekdaysOnly: detail.account.warmupDays === 62,
        readEmulation: detail.account.readEmulation ?? false,
        customTrackingDomain: detail.account.customTrackingDomain || "",
        warmupCustomTrackingDomain: detail.account.warmupCustomTrackingDomain ?? false,
        openRate: detail.account.warmupOpenRate ?? 100,
        spamProtection: detail.account.warmupSpamProtection ?? 100,
        markImportant: detail.account.warmupMarkImportant ?? 0,
      });
    } catch {}
    setLoading(false);
  }, [email]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function toggleWarmup() {
    if (!data) return;
    await fetch("/api/warmup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailAccountId: data.account.id, action: "toggle" }),
    });
    fetchDetail();
  }

  async function saveSettings() {
    if (!data) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const displayName = `${settings.firstName} ${settings.lastName}`.trim();
      const res = await fetch(`/api/email-accounts?id=${data.account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          warmupIncrease: settings.increasePerDay,
          warmupMax: settings.dailyLimit,
          warmupDays: settings.weekdaysOnly ? 62 : 127,
          warmupFilterTag: settings.filterTag,
          disableSlowWarmup: settings.disableSlowWarmup,
          warmupReplyRate: settings.replyRate,
          readEmulation: settings.readEmulation,
          warmupOpenRate: settings.openRate,
          warmupSpamProtection: settings.spamProtection,
          warmupMarkImportant: settings.markImportant,
          customTrackingDomain: settings.customTrackingDomain,
          warmupCustomTrackingDomain: settings.warmupCustomTrackingDomain,
        }),
      });
      if (res.ok) {
        setSaveMsg({ type: "success", text: "Settings saved" });
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        const err = await res.json();
        setSaveMsg({ type: "error", text: err.error || "Failed to save" });
      }
    } catch {
      setSaveMsg({ type: "error", text: "Failed to save" });
    }
    setSaving(false);
  }

  function updateSetting(key: string, value: any) {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  }

  function execFormat(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    if (sigRef.current) sigRef.current.focus();
  }

  if (loading) return <div className="px-6 lg:px-10 pt-8 text-sm text-muted">Loading...</div>;
  if (!data) return <div className="px-6 lg:px-10 pt-8 text-sm text-muted">Account not found</div>;

  const { account, warmup, campaigns } = data;
  const isActive = account.warmupEnabled && !account.isPaused;
  const created = new Date(account.createdAt);
  const maxChartVal = warmup?.daily?.length
    ? Math.max(...warmup.daily.map((d: any) => Math.max(d.sent, d.received, d.rescued)), 1)
    : 1;

  return (
    <div className="px-6 lg:px-10 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/dashboard/email-accounts")} className="text-muted hover:text-blue-accent transition-colors mr-1">
              <ChevronLeftIcon size={18} />
            </button>
            <h1 className="text-xl font-medium">{account.email}</h1>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {isActive ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-sm text-muted ml-[26px]">
            Started on {created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} &middot; {daysAgo(created)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{account.warmupEnabled ? "Enabled" : "Disabled"}</span>
          <button onClick={toggleWarmup}
            className={`relative w-9 h-5 rounded-full transition-colors ${account.warmupEnabled ? "bg-blue-accent" : "bg-border"}`}>
            <span className={`absolute block w-3.5 h-3.5 bg-white rounded-full top-1/2 -translate-y-1/2 transition-all ${account.warmupEnabled ? "left-[19px]" : "left-[3px]"}`} />
          </button>
        </div>
      </div>

      {account.status === "error" && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex-wrap">
          <div className="text-sm text-red-700">
            <p className="font-medium">This account needs to be reconnected</p>
            <p className="text-xs text-red-600 mt-0.5">Sending and reply detection are paused until you reconnect with the new password.</p>
          </div>
          <button onClick={() => setShowReconnect(true)} className="btn btn-primary shrink-0">Reconnect</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-7 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`text-sm py-2.5 px-5 border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-accent text-ink font-medium" : "border-transparent text-muted hover:text-blue-accent"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Warmup Tab */}
      {activeTab === "warmup" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
            <div className="bg-cream-2/50 border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Warmup emails received</p>
              <p className="text-2xl font-medium text-ink">{warmup?.summary?.warmupReceived ?? 0}</p>
            </div>
            <div className="bg-cream-2/50 border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Warmup emails sent</p>
              <p className="text-2xl font-medium text-ink">{warmup?.summary?.warmupSent ?? 0}</p>
            </div>
            <div className="bg-cream-2/50 border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Saved from spam</p>
              <p className="text-2xl font-medium text-ink">{warmup?.summary?.savedFromSpam ?? 0}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium mb-6">Warmup Emails Sent</h3>
            {!warmup?.daily?.length || warmup.daily.every((d: any) => d.sent === 0 && d.received === 0 && d.rescued === 0) ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted">No warmup data available for the last 7 days.</p>
                <p className="text-xs text-muted-2 mt-1">Warmup data will appear here once the account starts warming up.</p>
              </div>
            ) : (
              <div className="flex gap-2" style={{ minHeight: 200 }}>
                <div className="flex flex-col justify-between text-[10px] text-muted-2 pr-2 py-0.5 shrink-0" style={{ height: 170 }}>
                  {Array.from({ length: maxChartVal + 1 }, (_, i) => maxChartVal - i).map(n => (
                    <span key={n} className="leading-none">{n}</span>
                  ))}
                </div>
                <div className="flex-1 relative" style={{ height: 170 }}>
                  {Array.from({ length: maxChartVal + 1 }, (_, i) => i).map(n => (
                    <div key={n} className="absolute w-full border-t border-border" style={{ bottom: `${(n / maxChartVal) * 100}%`, height: 0 }} />
                  ))}
                  <div className="absolute inset-0 flex items-end justify-around pb-0">
                    {warmup.daily.map((day: any) => {
                      const totalH = maxChartVal > 0 ? (day.sent / maxChartVal) * 100 : 0;
                      const rescuedH = maxChartVal > 0 && day.rescued > 0 ? (day.rescued / maxChartVal) * 100 : 0;
                      return (
                        <div key={day.date} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                          <div className="w-8 rounded-t-sm bg-blue-accent transition-all group-hover:brightness-110 cursor-pointer relative overflow-hidden" style={{ height: `${totalH}%`, maxHeight: 160 }}>
                            {rescuedH > 0 && (
                              <div className="absolute bottom-0 w-full bg-amber-400" style={{ height: `${(day.rescued / day.sent) * 100}%` }} />
                            )}
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-[#1a1a1a] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                              <p className="font-medium mb-1">{day.label} — {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                              <p>Warmup Emails Sent: <span className="font-medium">{day.sent}</span></p>
                              <p>Landings in Spam: <span className="font-medium">{day.rescued}</span></p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {warmup?.daily?.length ? (
              <div className="flex justify-around text-[10px] text-muted-2 mt-2 pl-8">
                {warmup.daily.map((day: any) => (
                  <span key={day.date} className="flex-1 text-center">{day.label}</span>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="max-w-2xl space-y-8">
          {saveMsg && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${saveMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {saveMsg.type === "success" ? (
                <CircleCheckIcon size={16} />
              ) : (
                <CircleXIcon size={16} />
              )}
              <span>{saveMsg.text}</span>
            </div>
          )}

          {/* Panel 1: Sender Information */}
          <div>
            <h3 className="text-base font-medium text-[#1a1a1a] mb-5">Sender Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#666] mb-1.5">First Name</label>
                <input value={settings.firstName} onChange={e => updateSetting("firstName", e.target.value)}
                  className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent" />
              </div>
              <div>
                <label className="block text-xs text-[#666] mb-1.5">Last Name</label>
                <input value={settings.lastName} onChange={e => updateSetting("lastName", e.target.value)}
                  className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent" />
              </div>
              <div>
                <label className="block text-xs text-[#666] mb-1.5">Signature</label>
                <div className="border border-[#ddd] rounded-lg overflow-hidden">
                  <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#ddd] bg-white overflow-x-auto">
                    <button onClick={() => execFormat("bold")} className="w-7 h-7 flex items-center justify-center text-[#666] hover:text-blue-accent rounded hover:bg-gray-100" title="Bold"><BoldIcon size={14} /></button>
                    <button onClick={() => execFormat("italic")} className="w-7 h-7 flex items-center justify-center text-[#666] hover:text-blue-accent rounded hover:bg-gray-100" title="Italic"><ItalicIcon size={14} /></button>
                    <button onClick={() => execFormat("underline")} className="w-7 h-7 flex items-center justify-center text-[#666] hover:text-blue-accent rounded hover:bg-gray-100" title="Underline"><UnderlineIcon size={14} /></button>
                    <span className="w-px h-4 bg-[#ddd] mx-1" />
                    <button onClick={() => execFormat("foreColor", "#2563EB")} className="w-7 h-7 flex items-center justify-center text-[#666] hover:text-blue-accent rounded hover:bg-gray-100" title="Text color">
                      <TextColorIcon size={14} />
                    </button>
                    <button onClick={() => execFormat("removeFormat")} className="w-7 h-7 flex items-center justify-center text-xs text-[#666] hover:text-blue-accent rounded hover:bg-gray-100">A:</button>
                    <span className="w-px h-4 bg-[#ddd] mx-1" />
                    <button onClick={() => execFormat("insertHTML", "<code></code>")} className="w-7 h-7 flex items-center justify-center text-[#666] hover:text-blue-accent rounded hover:bg-gray-100" title="Code"><CodeXmlIcon size={14} /></button>
                    <span className="w-px h-4 bg-[#ddd] mx-1" />
                    <div className="relative group">
                      <button className="w-7 h-7 flex items-center justify-center text-xs text-[#666] hover:text-blue-accent rounded hover:bg-gray-100 gap-0.5">Tags <ChevronDownIcon size={10} /></button>
                      <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded-lg shadow-lg min-w-[160px] hidden group-hover:block z-10">
                        {["{{first_name}}", "{{last_name}}", "{{email}}", "{{company}}", "{{title}}"].map(tag => (
                          <button key={tag} onClick={() => { execFormat("insertHTML", tag); }} className="w-full text-left px-3 py-2 text-sm text-[#666] hover:bg-gray-50 rounded-lg">{tag}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div ref={sigRef} contentEditable suppressContentEditableWarning
                    className="min-h-[100px] p-3 text-sm outline-none bg-white"
                    onInput={e => updateSetting("signature", (e.target as HTMLDivElement).innerHTML)}
                    dangerouslySetInnerHTML={{ __html: settings.signature || "Start typing here..." }}
                    onFocus={e => { if (e.target.innerHTML === "Start typing here...") e.target.innerHTML = ""; }}
                    onBlur={e => { if (!e.target.innerHTML.trim()) e.target.innerHTML = "Start typing here..."; }}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-[#e5e7eb]" />

          {/* Panel 2: Warmup Settings */}
          <div>
            <h3 className="text-base font-medium text-[#1a1a1a] mb-5">Warmup Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#666] mb-1.5">Warmup filter tag</label>
                <input value={settings.filterTag} onChange={e => updateSetting("filterTag", e.target.value)}
                  className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent" placeholder="Custom tag (e.g. 'golden-pineapples')" />
              </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm text-[#666] sm:w-40 shrink-0">Default</span>
            <span className="text-sm font-mono text-[#666]">{account.warmupFilterTag || "—"}</span>
          </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <label className="text-sm text-[#666] sm:w-40 shrink-0">Increase per day</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={settings.increasePerDay} onChange={e => updateSetting("increasePerDay", parseInt(e.target.value) || 0)}
                    className="w-16 border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-center" />
                  <span className="text-xs text-[#999] italic">Suggested 1</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <label className="text-sm text-[#666] sm:w-40 shrink-0">Daily warmup limit</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={settings.dailyLimit} onChange={e => updateSetting("dailyLimit", parseInt(e.target.value) || 0)}
                    className="w-16 border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-center" />
                  <span className="text-xs text-[#999] italic">Suggested 10</span>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.disableSlowWarmup} onChange={e => updateSetting("disableSlowWarmup", e.target.checked)}
                  className="w-4 h-4 rounded border-[#ddd] text-blue-accent" />
                <span className="text-sm text-[#666]">Disable slow warmup</span>
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <label className="text-sm text-[#666] sm:w-40 shrink-0">Reply rate %</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={settings.replyRate} onChange={e => updateSetting("replyRate", parseInt(e.target.value) || 0)}
                    className="w-16 border border-[#ddd] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-center" />
                  <span className="text-xs text-[#999] italic">Suggested 30</span>
                </div>
              </div>

              {/* Show advanced settings link */}
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-accent hover:underline mt-2 flex items-center gap-1">
                {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
                {showAdvanced ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
              </button>
            </div>
          </div>

          {/* Panel 3: Warmup Settings Advanced */}
          {showAdvanced && (
            <div className="bg-[#f8f9fa] border border-[#e5e7eb] rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-[#1a1a1a]">Warmup Settings Advanced</h3>
                <button onClick={() => setShowAdvanced(false)}
                  className="text-sm text-blue-accent hover:underline flex items-center gap-1">
                  Hide advanced settings <ChevronUpIcon size={12} />
                </button>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-[#1a1a1a]">Weekdays only</p>
                  <p className="text-[12px] text-[#666] mt-1">Only send warmup emails on weekdays for a more natural sending pattern</p>
                </div>
                <button onClick={() => updateSetting("weekdaysOnly", !settings.weekdaysOnly)}
                  className={`relative w-[38px] h-[21px] rounded-full transition-colors shrink-0 self-start sm:self-center ${settings.weekdaysOnly ? "bg-blue-accent" : "bg-[#ccc]"}`}>
                  <span className={`absolute block w-[17px] h-[17px] bg-white rounded-full top-[2px] shadow-sm transition-all ${settings.weekdaysOnly ? "left-[19px]" : "left-[2px]"}`} />
                </button>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-[#1a1a1a]">Read emulation</p>
                  <p className="text-[12px] text-[#666] mt-1">Spend time and scroll through your warmup email to emulate human-like reading</p>
                </div>
                <button onClick={() => updateSetting("readEmulation", !settings.readEmulation)}
                  className={`relative w-[38px] h-[21px] rounded-full transition-colors shrink-0 self-start sm:self-center ${settings.readEmulation ? "bg-blue-accent" : "bg-[#ccc]"}`}>
                  <span className={`absolute block w-[17px] h-[17px] bg-white rounded-full top-[2px] shadow-sm transition-all ${settings.readEmulation ? "left-[19px]" : "left-[2px]"}`} />
                </button>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-bold text-[#1a1a1a]">Warm custom tracking domain</p>
                    <p className="text-[12px] text-[#666] mt-1">Include your custom tracking domain in your warmup emails to further improve deliverability</p>
                  </div>
                  <button onClick={() => updateSetting("warmupCustomTrackingDomain", !settings.warmupCustomTrackingDomain)}
                    className={`relative w-[38px] h-[21px] rounded-full transition-colors shrink-0 self-start sm:self-center ${settings.warmupCustomTrackingDomain ? "bg-blue-accent" : "bg-[#ccc]"}`}>
                    <span className={`absolute block w-[17px] h-[17px] bg-white rounded-full top-[2px] shadow-sm transition-all ${settings.warmupCustomTrackingDomain ? "left-[19px]" : "left-[2px]"}`} />
                  </button>
                </div>
                {settings.warmupCustomTrackingDomain && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-[#999]">Your tracking domain</p>
                    <input value={settings.customTrackingDomain} onChange={e => updateSetting("customTrackingDomain", e.target.value)}
                      className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent"
                      placeholder="track.yourdomain.com" />
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                  <p className="text-[14px] font-bold text-[#1a1a1a]">Open Rate</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} value={settings.openRate} onChange={e => {
                      const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      updateSetting("openRate", v);
                    }} className="w-[70px] border border-[#ddd] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-accent text-center" />
                    <span className="text-sm text-[#666]">%</span>
                  </div>
                </div>
                <p className="text-[12px] text-[#666]">How many of your warm up emails to open</p>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                  <p className="text-[14px] font-bold text-[#1a1a1a]">Spam Protection</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} value={settings.spamProtection} onChange={e => {
                      const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      updateSetting("spamProtection", v);
                    }} className="w-[70px] border border-[#ddd] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-accent text-center" />
                    <span className="text-sm text-[#666]">%</span>
                  </div>
                </div>
                <p className="text-[12px] text-[#666]">How many of your warm up emails to save from spam folder</p>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                  <p className="text-[14px] font-bold text-[#1a1a1a]">Mark Important</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} value={settings.markImportant} onChange={e => {
                      const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      updateSetting("markImportant", v);
                    }} className="w-[70px] border border-[#ddd] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-accent text-center" />
                    <span className="text-sm text-[#666]">%</span>
                  </div>
                </div>
                <p className="text-[12px] text-[#666]">How many of your warm up emails to mark as important</p>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="flex justify-end pt-2">
            <button onClick={saveSettings} disabled={saving} className="bg-blue-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-accent-hover transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {showReconnect && (
        <ReconnectModal
          account={account}
          onClose={() => setShowReconnect(false)}
          onReconnected={fetchDetail}
        />
      )}

    </div>
  );
}
