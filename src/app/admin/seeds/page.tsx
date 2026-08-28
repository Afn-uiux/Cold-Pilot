"use client";

import { useCallback, useEffect, useState } from "react";
import AccountsConnector from "@/components/accounts-connector";

type SeedStats = {
  sentToday: number; sentWeek: number;
  receivedToday: number; receivedWeek: number;
  repliedToday: number; repliedWeek: number;
  rescuedToday: number; rescuedWeek: number;
};

type Seed = {
  id: string;
  email: string;
  provider: string;
  displayName: string | null;
  status: string;
  healthScore: number;
  healthState: string;
  lastUsedAt: string | null;
  note: string | null;
  createdAt: string;
  dailyTarget: number;
  warmupBase: number;
  warmupIncrease: number;
  warmupStartedAt: string | null;
  scheduleStart: string;
  scheduleEnd: string;
  minWaitMinutes: number;
  replyRate: number;
  openRate: number;
  spamProtection: number;
  markImportant: number;
  stats: SeedStats;
};

const DEFAULT_SETTINGS: Record<string, number | string> = {
  dailyTarget: 10,
  warmupBase: 2,
  warmupIncrease: 2,
  scheduleStart: "09:00",
  scheduleEnd: "17:00",
  minWaitMinutes: 10,
  replyRate: 75,
  openRate: 100,
  spamProtection: 100,
  markImportant: 10,
};

export default function AdminSeedsPage() {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Seed | null>(null);
  const [settings, setSettings] = useState<Record<string, number | string>>({ ...DEFAULT_SETTINGS });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/seeds${q}`);
      const data = await res.json();
      if (data.seeds && res.ok) setSeeds(data.seeds);
      else setError(data.error || "Failed to load");
    } catch {
      setError("Failed to load seeds");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function startEdit(seed: Seed) {
    setEditing(seed);
    setSettings({
      dailyTarget: seed.dailyTarget ?? 10,
      warmupBase: seed.warmupBase ?? 2,
      warmupIncrease: seed.warmupIncrease ?? 2,
      scheduleStart: seed.scheduleStart || "09:00",
      scheduleEnd: seed.scheduleEnd || "17:00",
      minWaitMinutes: seed.minWaitMinutes ?? 10,
      replyRate: seed.replyRate ?? 75,
      openRate: seed.openRate ?? 100,
      spamProtection: seed.spamProtection ?? 100,
      markImportant: seed.markImportant ?? 10,
    });
  }

  async function saveSettings() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/seeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...settings }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error || "Failed to save"); return; }
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string, status: string) {
    setBusyId(id);
    const target = status === "active" ? "paused" : "active";
    fetch("/api/admin/seeds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: target }),
    }).then(() => load()).finally(() => setBusyId(null));
  }

  async function quarantine(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/admin/seeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "quarantined" }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this seed inbox?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/seeds?id=${id}`, { method: "DELETE" });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = seeds.filter(s => filter === "all" || s.status === filter);
  const counts = {
    all: seeds.length,
    active: seeds.filter(s => s.status === "active").length,
    paused: seeds.filter(s => s.status === "paused").length,
    quarantined: seeds.filter(s => s.status === "quarantined").length,
  };

  const sum = (k: keyof SeedStats) => seeds.reduce((a, s) => a + (s.stats?.[k] || 0), 0);

  const network = [
    { label: "Sent", today: sum("sentToday"), week: sum("sentWeek") },
    { label: "Received", today: sum("receivedToday"), week: sum("receivedWeek") },
    { label: "Replied", today: sum("repliedToday"), week: sum("repliedWeek") },
    { label: "Rescued from spam", today: sum("rescuedToday"), week: sum("rescuedWeek") },
  ];

  const num = (v: number | string) => Number(v) || 0;
  const str = (v: number | string) => String(v ?? "");

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0 flex items-start justify-between">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">Seed Inboxes</h1>
          <p className="text-sm text-muted mt-1.5">Platform-owned warmup network. Seeds engage bidirectionally: send, receive, reply, rescue from spam.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm flex items-center gap-2 px-4 py-2 rounded-full bg-blue-accent text-white hover:opacity-90 transition-opacity"
        >
          + Add Seed
        </button>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</div>
        )}

        {/* Network overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {network.map(n => (
            <div key={n.label} className="border border-border rounded-xl p-4 bg-white">
              <div className="text-xs uppercase tracking-wider text-muted-2 mb-1">{n.label}</div>
              <div className="text-2xl font-semibold">{n.today}<span className="text-sm font-normal text-muted-2 ml-1">today</span></div>
              <div className="text-xs text-muted mt-0.5">{n.week} this week</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {(["all", "active", "paused", "quarantined"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${filter === s ? "bg-blue-accent text-white border-blue-accent" : "border-border text-muted hover:text-ink"}`}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase tracking-wider text-muted-2">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3 text-center">Sent <span className="text-muted-2 normal-case">(7d)</span></th>
                <th className="px-4 py-3 text-center">Recv <span className="text-muted-2 normal-case">(7d)</span></th>
                <th className="px-4 py-3 text-center">Replied <span className="text-muted-2 normal-case">(7d)</span></th>
                <th className="px-4 py-3 text-center">Rescued <span className="text-muted-2 normal-case">(7d)</span></th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && visible.map(s => (
                <tr key={s.id} className={s.status === "quarantined" ? "bg-red-50/50" : ""}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.email}</div>
                    <div className="text-xs text-muted-2 mt-0.5">
                      <span className="capitalize">{s.provider}</span>
                      {s.displayName && <> · {s.displayName}</>}
                      {s.note && <> · <span className="italic">{s.note}</span></>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusColor(s.status)}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={s.healthScore < 70 ? "text-red-600" : s.healthScore < 85 ? "text-amber-600" : "text-green-600"}>{Math.round(s.healthScore)}</div>
                    <div className="text-xs text-muted-2 capitalize">{s.healthState}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{s.stats?.sentWeek ?? 0}</td>
                  <td className="px-4 py-3 text-center">{s.stats?.receivedWeek ?? 0}</td>
                  <td className="px-4 py-3 text-center">{s.stats?.repliedWeek ?? 0}</td>
                  <td className="px-4 py-3 text-center">{s.stats?.rescuedWeek ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {s.status === "quarantined" ? (
                        <button onClick={() => toggle(s.id, "quarantined")} disabled={busyId === s.id} className="text-xs px-2.5 py-1 rounded-md bg-green-600 text-white hover:opacity-90 disabled:opacity-50">Re-activate</button>
                      ) : (
                        <button onClick={() => toggle(s.id, s.status)} disabled={busyId === s.id} className={`text-xs px-2.5 py-1 rounded-md text-white hover:opacity-90 disabled:opacity-50 ${s.status === "active" ? "bg-amber-500" : "bg-green-600"}`}>{s.status === "active" ? "Pause" : "Warm"}</button>
                      )}
                      <button onClick={() => startEdit(s)} disabled={busyId === s.id} className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-blue-accent hover:border-blue-300 transition-colors disabled:opacity-50">Settings</button>
                      {s.status !== "quarantined" && (
                        <button onClick={() => quarantine(s.id)} disabled={busyId === s.id} className="text-xs px-2.5 py-1 rounded-md bg-red-600 text-white hover:opacity-90 disabled:opacity-50">Quarantine</button>
                      )}
                      <button onClick={() => remove(s.id)} disabled={busyId === s.id} className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No seeds yet. Add your first seed inbox above.</td></tr>
              )}
              {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Loading...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AccountsConnector variant="seed" open={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />

      {/* Settings modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-border rounded-t-2xl">
              <div className="font-semibold">Warmup settings</div>
              <div className="text-xs text-muted">{editing.email}</div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-muted-2">Daily target (emails/day at ramp peak)</label>
                <input type="number" min={1} max={500} value={num(settings.dailyTarget)} onChange={e => setSettings(s => ({ ...s, dailyTarget: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
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
                <label className="text-xs text-muted-2">Min wait between sends (minutes)</label>
                <input type="number" min={1} max={180} value={num(settings.minWaitMinutes)} onChange={e => setSettings(s => ({ ...s, minWaitMinutes: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-2">Reply rate (%)</label>
                  <input type="number" min={0} max={100} value={num(settings.replyRate)} onChange={e => setSettings(s => ({ ...s, replyRate: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-2">Open rate (%)*</label>
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
              <p className="text-[11px] text-muted-2">*Open rate is stored for network consistency. Reply, spam-rescue and mark-important are applied live.</p>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-ink">Cancel</button>
              <button onClick={saveSettings} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Save settings"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "active": return "bg-green-100 text-green-700";
    case "paused": return "bg-amber-100 text-amber-700";
    case "quarantined": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}
