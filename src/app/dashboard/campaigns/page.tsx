"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/confirm-modal";
import Select from "@/components/select";

type Campaign = { id: string; name: string; status: string; leads: number; steps: number; };

const STATUSES = ["all", "active", "draft", "paused", "completed", "error", "evergreen"] as const;

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState("newest");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("My Campaign");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCampaigns(data.map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            leads: c._count?.leads || 0,
            steps: c._count?.steps || 0,
          })));
        } else {
          setCampaigns([]);
        }
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

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
        setShowCreate(false);
        setNewName("My Campaign");
        // Reload campaigns from API
        const data = await res.json();
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

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Campaigns</h1>
          <p className="text-sm text-muted mt-1.5">{campaigns.length} total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ New Campaign</button>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns..." />
            </div>
            <div className="w-36">
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
            <h3>No campaigns yet</h3>
            <p>Create your first campaign to get started.</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">Create campaign</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th>Steps</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted-2 py-12">No campaigns match your filters</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}>
                    <td className="font-medium">{c.name}</td>
                    <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                    <td>{c.leads}</td>
                    <td>{c.steps}</td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(c.id); }} className="text-xs text-muted-2 hover:text-red-600 transition-colors">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowCreate(false)}>
          <div className="bg-cream border border-border rounded-lg w-[90%] max-w-[480px] p-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreate(false)} className="text-sm text-muted hover:text-blue-accent mb-6 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
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
              <button onClick={handleCreate} className="btn btn-primary flex-1">Continue →</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title="Delete campaign?"
        message="This will permanently delete this campaign and its data."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}
