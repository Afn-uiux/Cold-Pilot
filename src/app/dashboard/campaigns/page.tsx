"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/confirm-modal";
import Select from "@/components/select";
import { PauseIcon } from "@/components/icons/pause";
import { PlayIcon } from "@/components/icons/play";
import { Search01Icon } from "@/components/icons/search-01";
import { Mail01Icon } from "@/components/icons/mail-01";
import { ArrowLeft02Icon } from "@/components/icons/arrow-left-02";
import { ArrowRight02Icon } from "@/components/icons/arrow-right-02";

type CampaignMetrics = {
  sentCount: number;
  clickCount: number;
  repliedCount: number;
  repliedLeads: number;
  opportunities: number;
  totalLeads: number;
  completedLeads: number;
  progress: number;
  replyRate: number;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  leads: number;
  steps: number;
  metrics?: CampaignMetrics;
};

const STATUSES = ["all", "active", "draft", "paused", "completed"] as const;

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; cls: string }> = {
    active: { label: "active", cls: "bg-green-50 text-green-700 border-green-200" },
    draft: { label: "draft", cls: "bg-gray-50 text-gray-500 border-gray-200" },
    paused: { label: "paused", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    completed: { label: "completed", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const cfg = configs[status] || configs.draft;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium tracking-wide px-2.5 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink">{value}%</span>
      <div className="w-[60px] h-1 rounded-full bg-border overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("My Campaign");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{ id: string; action: string; name: string } | null>(null);

  const fetchCampaigns = useCallback(() => {
    fetch("/api/campaigns")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCampaigns(data.map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            leads: c._count?.leads || 0,
            steps: c._count?.steps || 0,
            metrics: c.metrics || undefined,
          })));
        } else {
          setCampaigns([]);
        }
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const filtered = campaigns
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => statusFilter === "all" || c.status === statusFilter);

  async function handleCreate() {
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, steps: [{ type: "email", subject: "", body: "" }] }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setNewName("My Campaign");
        setCampaigns(prev => [{ id: data.id, name: data.name, status: data.status, leads: 0, steps: data.steps?.length || 0 }, ...prev]);
      }
    } catch {}
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/campaigns?id=${deleteId}`, { method: "DELETE" });
    if (res.ok) setCampaigns(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
  }

  function handleAction(id: string, action: string) {
    const c = campaigns.find(c => c.id === id);
    if (!c) return;
    setActionConfirm({ id, action, name: c.name });
  }

  async function confirmAction() {
    if (!actionConfirm) return;
    const newStatus = actionConfirm.action === "launch" || actionConfirm.action === "resume" ? "active" : "paused";
    const res = await fetch(`/api/campaigns?id=${actionConfirm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setCampaigns(prev => prev.map(c => c.id === actionConfirm.id ? { ...c, status: newStatus } : c));
    }
    setActionConfirm(null);
  }

  function ActionIcon({ campaign }: { campaign: Campaign }) {
    if (campaign.status === "active") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleAction(campaign.id, "pause"); }}
          className="p-1 text-muted-2 hover:text-ink transition-colors"
          title="Pause campaign"
        >
          <PauseIcon size={14} />
        </button>
      );
    }
    if (campaign.status === "paused") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleAction(campaign.id, "resume"); }}
          className="p-1 text-muted-2 hover:text-green-600 transition-colors"
          title="Resume campaign"
        >
          <PlayIcon size={14} />
        </button>
      );
    }
    if (campaign.status === "draft") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleAction(campaign.id, "launch"); }}
          className="p-1 text-muted-2 hover:text-green-600 transition-colors"
          title="Launch campaign"
        >
          <PlayIcon size={14} />
        </button>
      );
    }
    return null;
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="text-[32px] font-medium tracking-tight leading-tight text-ink m-0">Campaigns</h1>
          <div className="text-sm text-muted mt-1">{campaigns.length} total</div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ New Campaign</button>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="toolbar">
          <div className="toolbar-left flex-col sm:flex-row gap-2">
            <div className="search flex-1 max-w-none">
              <Search01Icon size={14} className="pointer-events-none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#7A9AB5" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns..." style={{ paddingLeft: 42 }} />
            </div>
            <div className="w-full sm:w-40">
              <Select value={statusFilter} onChange={setStatusFilter}
                options={STATUSES.map(s => ({ value: s, label: s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1) }))}
                triggerClassName="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm bg-transparent font-medium text-xs tracking-wider text-muted outline-none focus:border-ink text-left" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-2 flex items-center justify-center">
              <Mail01Icon size={28} className="text-muted-2" />
            </div>
            <h3>No campaigns yet</h3>
            <p>Create your first campaign to get started.</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ New Campaign</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Sent</th>
                  <th>Click</th>
                  <th>Replied</th>
                  <th>Opportunities</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-muted-2 py-12">No campaigns match your filters</td></tr>
                ) : filtered.map(c => {
                  const m = c.metrics;
                  const isDraft = c.status === "draft";
                  return (
                    <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}>
                      <td className="font-medium">{c.name}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        {isDraft || !m ? (
                          <span className="text-muted-2">-</span>
                        ) : (
                          <ProgressBar value={m.progress} />
                        )}
                      </td>
                      <td>{isDraft || !m ? <span className="text-muted-2">-</span> : m.sentCount}</td>
                      <td>{isDraft || !m ? <span className="text-muted-2">-</span> : m.clickCount}</td>
                      <td>
                        {isDraft || !m ? (
                          <span className="text-muted-2">-</span>
                        ) : (
                          <span>{m.repliedLeads} <span className="text-muted-2">| {m.replyRate}%</span></span>
                        )}
                      </td>
                      <td>{isDraft || !m ? 0 : m.opportunities}</td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <ActionIcon campaign={c} />
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                            className="text-xs text-muted-2 hover:text-red-600 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowCreate(false)}>
          <div className="bg-cream border border-border rounded-lg w-[90%] max-w-[480px] p-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreate(false)} className="text-sm text-muted hover:text-blue-accent mb-6 flex items-center gap-1.5">
              <ArrowLeft02Icon size={14} />
              Back
            </button>
            <h2 className="font-medium text-2xl font-normal mb-6">Let's create a new campaign</h2>
            <div className="field-group">
              <label className="block text-xs text-muted mb-2">Campaign Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full bg-transparent border-b border-border pb-2.5 text-lg outline-none focus:border-ink transition-colors font-medium" />
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleCreate} className="btn btn-primary flex-1">Continue <ArrowRight02Icon size={14} /></button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title="Delete campaign?"
        message="This will permanently delete this campaign and all its data including leads and email logs."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />

      <ConfirmModal
        open={actionConfirm !== null}
        title={`${actionConfirm?.action === "launch" ? "Launch" : actionConfirm?.action === "pause" ? "Pause" : "Resume"} campaign?`}
        message={
          actionConfirm?.action === "launch"
            ? `This will start sending emails from "${actionConfirm?.name}". Make sure your sequences and schedule are configured.`
            : actionConfirm?.action === "pause"
            ? `This will pause "${actionConfirm?.name}". No more emails will be sent until you resume.`
            : `This will resume "${actionConfirm?.name}". Emails will start sending again based on the schedule.`
        }
        confirmLabel={actionConfirm?.action === "launch" ? "Launch" : actionConfirm?.action === "pause" ? "Pause" : "Resume"}
        onConfirm={confirmAction}
        onCancel={() => setActionConfirm(null)}
      />
    </div>
  );
}
