"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/icons/chevron-left";

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const t = raw.trim();
  if (!t) return [];
  try {
    if (t.startsWith("[")) {
      const p = JSON.parse(t);
      if (Array.isArray(p)) return p.filter((x): x is string => typeof x === "string");
    }
  } catch { /* fall through */ }
  return t.split(",").map((x) => x.trim()).filter(Boolean);
}

function daysAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

const TABS = [
  { key: "warmup", label: "Warmup" },
  { key: "settings", label: "Settings" },
];

type Daily = { date: string; label: string; sent: number; received: number; rescued: number };

export default function AdminSeedDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("warmup");
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [settings, setSettings] = useState<Record<string, number | string>>({});

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/seeds/${id}`);
      const json = await res.json();
      if (res.ok && json.seed) {
        setData(json);
        const s = json.seed;
        setSettings({
          tags: parseTags(s.tags).join(", "),
          filterTag: s.filterTag || "",
          dailyTarget: s.dailyTarget ?? 10,
          warmupBase: s.warmupBase ?? 2,
          warmupIncrease: s.warmupIncrease ?? 2,
          scheduleStart: s.scheduleStart || "09:00",
          scheduleEnd: s.scheduleEnd || "17:00",
          minWaitMinutes: s.minWaitMinutes ?? 10,
          replyRate: s.replyRate ?? 75,
          openRate: s.openRate ?? 100,
          spamProtection: s.spamProtection ?? 100,
          markImportant: s.markImportant ?? 10,
        });
      } else {
        setSaveMsg({ type: "error", text: json.error || "Failed to load seed" });
      }
    } catch {
      setSaveMsg({ type: "error", text: "Failed to load seed" });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  function regenerateFilterTag() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let tag = "";
    for (let i = 0; i < 6; i++) tag += chars[Math.floor(Math.random() * chars.length)];
    setSettings((s) => ({ ...s, filterTag: tag }));
  }

  async function saveSettings() {
    if (!data) return;
    setBusy(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/seeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.seed.id, ...settings }),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg({ type: "success", text: "Settings saved" });
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        setSaveMsg({ type: "error", text: json.error || "Failed to save" });
      }
    } catch {
      setSaveMsg({ type: "error", text: "Failed to save" });
    }
    setBusy(false);
  }

  async function toggleWarmup() {
    if (!data) return;
    setBusy(true);
    const target = data.seed.status === "active" ? "paused" : "active";
    try {
      await fetch("/api/admin/seeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.seed.id, status: target }),
      });
      fetchDetail();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="px-6 lg:px-10 pt-8 text-sm text-muted">Loading...</div>;
  if (!data) return <div className="px-6 lg:px-10 pt-8 text-sm text-muted">Seed not found</div>;

  const { seed, warmup } = data;
  const isActive = seed.status === "active";
  const created = new Date(seed.createdAt);
  const maxChartVal = warmup?.daily?.length
    ? Math.max(...warmup.daily.map((d: Daily) => Math.max(d.sent, d.received, d.rescued)), 1)
    : 1;
  const num = (v: number | string) => Number(v) || 0;
  const str = (v: number | string) => String(v ?? "");

  return (
    <div className="px-6 lg:px-10 py-8 max-w-5xl mx-auto">
      {saveMsg && saveMsg.type === "error" && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{saveMsg.text}</div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/admin/seeds")} className="text-muted hover:text-blue-accent transition-colors mr-1">
              <ChevronLeftIcon size={18} />
            </button>
            <h1 className="text-xl font-medium">{seed.email}</h1>
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
          <span className="text-xs text-muted">{isActive ? "Warming" : "Not warming"}</span>
          <button onClick={toggleWarmup} disabled={busy}
            className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? "bg-blue-accent" : "bg-border"}`}>
            <span className={`absolute block w-3.5 h-3.5 bg-white rounded-full top-1/2 -translate-y-1/2 transition-all ${isActive ? "left-[19px]" : "left-[3px]"}`} />
          </button>
        </div>
      </div>

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
            {!warmup?.daily?.length || warmup.daily.every((d: Daily) => d.sent === 0 && d.received === 0 && d.rescued === 0) ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted">No warmup data available for the last 7 days.</p>
                <p className="text-xs text-muted-2 mt-1">Warmup data will appear here once the seed starts warming up.</p>
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
                    {warmup.daily.map((day: Daily) => {
                      const totalH = maxChartVal > 0 ? (day.sent / maxChartVal) * 100 : 0;
                      const rescuedH = maxChartVal > 0 && day.rescued > 0 ? (day.rescued / maxChartVal) * 100 : 0;
                      return (
                        <div key={day.date} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                          <div className="w-8 rounded-t-sm bg-blue-accent transition-all group-hover:brightness-110 cursor-pointer relative overflow-hidden" style={{ height: `${totalH}%`, maxHeight: 160 }}>
                            {rescuedH > 0 && (
                              <div className="absolute bottom-0 w-full bg-amber-400" style={{ height: `${rescuedH}%` }} />
                            )}
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-[#1a1a1a] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                              <p className="font-medium mb-1">{day.label} — {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                              <p>Warmup Emails Sent: <span className="font-medium">{day.sent}</span></p>
                              <p>Warmup Emails Received: <span className="font-medium">{day.received}</span></p>
                              <p>Rescued from Spam: <span className="font-medium">{day.rescued}</span></p>
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
                {warmup.daily.map((day: Daily) => (
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
              <span>{saveMsg.text}</span>
            </div>
          )}

          <div>
            <h3 className="text-base font-medium text-[#1a1a1a] mb-5">Warmup Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#666] mb-1.5">Daily target (emails/day at ramp peak)</label>
                <input type="number" min={1} max={500} value={num(settings.dailyTarget)} onChange={e => setSettings(s => ({ ...s, dailyTarget: e.target.value }))} className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent" />
                <p className="text-[11px] text-muted-2 mt-1">Day 1 starts at {num(settings.warmupBase)} and grows +{num(settings.warmupIncrease)}/day up to this cap.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-2">Ramp start (day 1)</label>
                  <input type="number" min={1} max={100} value={num(settings.warmupBase)} onChange={e => setSettings(s => ({ ...s, warmupBase: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-2">Daily increase</label>
                  <input type="number" min={0} max={50} value={num(settings.warmupIncrease)} onChange={e => setSettings(s => ({ ...s, warmupIncrease: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-2">Start time</label>
                  <input type="time" value={str(settings.scheduleStart)} onChange={e => setSettings(s => ({ ...s, scheduleStart: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-2">End time</label>
                  <input type="time" value={str(settings.scheduleEnd)} onChange={e => setSettings(s => ({ ...s, scheduleEnd: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-2">Tags (comma-separated — spun into subjects & body ends)</label>
                <input type="text" value={str(settings.tags)} onChange={e => setSettings(s => ({ ...s, tags: e.target.value }))} placeholder="fintech, lagos, saas" className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-2">Filter tag (auto-generated tracking code, like mailbox filter tags)</label>
                <div className="mt-1 flex gap-2">
                  <input type="text" value={str(settings.filterTag)} onChange={e => setSettings(s => ({ ...s, filterTag: e.target.value }))} placeholder="x7k2qd" className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono" />
                  <button type="button" onClick={regenerateFilterTag} className="px-3 py-2 rounded-lg border border-border text-sm text-muted hover:text-blue-accent hover:border-blue-300 transition-colors whitespace-nowrap">Regenerate</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-2">Min wait between sends (minutes)</label>
                <input type="number" min={1} max={180} value={num(settings.minWaitMinutes)} onChange={e => setSettings(s => ({ ...s, minWaitMinutes: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-2">Reply rate (%)</label>
                  <input type="number" min={0} max={100} value={num(settings.replyRate)} onChange={e => setSettings(s => ({ ...s, replyRate: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-2">Open rate (%)</label>
                  <input type="number" min={0} max={100} value={num(settings.openRate)} onChange={e => setSettings(s => ({ ...s, openRate: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-2">Spam-protect rescue (%)</label>
                  <input type="number" min={0} max={100} value={num(settings.spamProtection)} onChange={e => setSettings(s => ({ ...s, spamProtection: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-2">Mark important (%)</label>
                  <input type="number" min={0} max={100} value={num(settings.markImportant)} onChange={e => setSettings(s => ({ ...s, markImportant: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={saveSettings} disabled={busy} className="px-6 py-2.5 rounded-lg bg-blue-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{busy ? "Saving..." : "Save settings"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}