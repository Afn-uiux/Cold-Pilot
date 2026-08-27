"use client";

import { useState, useEffect } from "react";
import Select from "@/components/select";
import { Settings01Icon } from "@/components/icons/settings-01";
import { Cancel01Icon } from "@/components/icons/cancel-01";

interface PipelineData { id: string; name: string; stages: string; _count: { deals: number } }
interface LeadData { id: string; firstName: string | null; lastName: string | null; email: string; company: string | null }
interface DealData { id: string; name: string; value: number; stage: string; status: string; notes: string | null; leadId: string | null; lead: LeadData | null; pipeline: { name: string }; _count: { tasks: number }; createdAt: string }

export default function CrmPage() {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [editDeal, setEditDeal] = useState<DealData | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editValue, setEditValue] = useState("");

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDealName, setNewDealName] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [newDealStage, setNewDealStage] = useState("");
  const [newDealLeadId, setNewDealLeadId] = useState("");
  const [leads, setLeads] = useState<LeadData[]>([]);

  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newPipelineStages, setNewPipelineStages] = useState("qualified\ndemo\nnegotiation\nwon\nlost");

  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsStages, setSettingsStages] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/crm/seed", { method: "POST" });
        if (res.ok) {
          const seeded = await res.json();
          setPipelines(seeded.pipelines);
          setSelectedPipelineId(seeded.pipelineId);
        } else {
          const pipes = await fetch("/api/pipelines").then(r => r.ok && r.json());
          if (pipes?.length > 0) { setPipelines(pipes); setSelectedPipelineId(pipes[0].id); }
        }
      } catch {}
      try {
        const res = await fetch("/api/leads");
        if (res.ok) { const data = await res.json(); setLeads(Array.isArray(data) ? data : []); }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!selectedPipelineId) return;
    fetch(`/api/deals?pipelineId=${selectedPipelineId}`).then(r => r.ok && r.json()).then(setDeals);
  }, [selectedPipelineId]);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  let stages: string[] = [];
  try { stages = selectedPipeline ? JSON.parse(selectedPipeline.stages) : []; } catch {}
  const positiveStages = ["lead", "interested", "meeting_booked", "meeting_completed", "won"];
  const negativeStages = ["no_show", "out_of_office", "wrong_person", "not_interested", "lost"];

  async function updateDeal(id: string, data: Record<string, any>) {
    await fetch("/api/deals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...data } : d));
  }

  async function createDeal() {
    if (!newDealName.trim() || !selectedPipelineId) return;
    const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipelineId: selectedPipelineId, name: newDealName.trim(), value: parseFloat(newDealValue) || 0, stage: newDealStage || stages[0] || "qualified", leadId: newDealLeadId || undefined }) });
    if (res.ok) {
      const deal = await res.json();
      deal.pipeline = { name: selectedPipeline?.name || "" };
      deal._count = { tasks: 0 };
      deal.lead = newDealLeadId ? leads.find(l => l.id === newDealLeadId) || null : null;
      setDeals(prev => [deal, ...prev]);
      setNewDealName(""); setNewDealValue(""); setNewDealStage(""); setNewDealLeadId("");
      setShowNewDeal(false);
      showToast("Deal created");
    }
  }

  async function createPipeline() {
    if (!newPipelineName.trim()) return;
    const stagesArr = newPipelineStages.split("\n").map(s => s.trim()).filter(Boolean);
    if (stagesArr.length === 0) return;
    const res = await fetch("/api/pipelines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newPipelineName.trim(), stages: JSON.stringify(stagesArr) }) });
    if (res.ok) {
      const p = await res.json();
      p._count = { deals: 0 };
      setPipelines(prev => [...prev, p]);
      setSelectedPipelineId(p.id);
      setNewPipelineName(""); setNewPipelineStages("qualified\ndemo\nnegotiation\nwon\nlost");
      setShowNewPipeline(false);
      showToast("Pipeline created");
    }
  }

  async function savePipelineSettings() {
    if (!selectedPipelineId || !settingsName.trim()) return;
    const stagesArr = settingsStages.split("\n").map(s => s.trim()).filter(Boolean);
    await fetch("/api/pipelines", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedPipelineId, name: settingsName.trim(), stages: JSON.stringify(stagesArr) }) });
    setPipelines(prev => prev.map(p => p.id === selectedPipelineId ? { ...p, name: settingsName.trim(), stages: JSON.stringify(stagesArr) } : p));
    setShowPipelineSettings(false);
    showToast("Pipeline updated");
  }

  async function deletePipeline() {
    if (!selectedPipelineId) return;
    await fetch(`/api/pipelines?id=${selectedPipelineId}`, { method: "DELETE" });
    const remaining = pipelines.filter(p => p.id !== selectedPipelineId);
    setPipelines(remaining);
    setSelectedPipelineId(remaining[0]?.id || "");
    setShowPipelineSettings(false);
    showToast("Pipeline deleted");
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault();
    if (dragId) { updateDeal(dragId, { stage: newStage }); setDragId(null); }
  }

  function renderColumn(stage: string, dotColor: string) {
    const stageDeals = deals.filter(d => d.stage === stage);
    return (
      <div key={stage} className="min-w-[220px] w-[220px] flex flex-col rounded-xl bg-cream-2/50 border border-border shrink-0"
        onDragOver={onDragOver} onDrop={e => onDrop(e, stage)}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-sm font-medium capitalize text-ink">{stage.replace(/_/g, " ")}</span>
          </div>
          <span className="text-xs text-muted-2 bg-cream border border-border rounded-full px-2 py-0.5">{stageDeals.length}</span>
        </div>
        <div className="flex-1 p-2.5 space-y-2 overflow-y-auto" style={{ minHeight: 120 }}>
          {stageDeals.map(deal => (
            <div key={deal.id} draggable onDragStart={e => onDragStart(e, deal.id)}
              onClick={() => { setEditDeal(deal); setEditNotes(deal.notes || ""); setEditValue(String(deal.value)); }}
              className="bg-cream border border-border rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-ink leading-snug mb-1">{deal.name}</p>
              {deal.lead && (
                <p className="text-[11px] text-muted-2 mb-1 truncate">{deal.lead.firstName || deal.lead.email}{deal.lead.company ? ` · ${deal.lead.company}` : ""}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">${deal.value.toLocaleString()}</span>
                {deal._count.tasks > 0 && <span className="text-[10px] text-muted-2">{deal._count.tasks} tasks</span>}
              </div>
            </div>
          ))}
          {stageDeals.length === 0 && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-2 border-2 border-dashed border-border rounded-lg">
              Drop deal here
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-10 pt-8 pb-16">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-[clamp(24px,3vw,32px)] font-medium tracking-tight mb-4">CRM</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedPipelineId} onChange={setSelectedPipelineId}
            options={pipelines.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Select pipeline"
            triggerClassName="flex items-center justify-between gap-2 bg-cream border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent min-w-[140px] sm:min-w-[160px] text-left"
          />
          {selectedPipelineId && (
            <button onClick={() => { setSettingsName(selectedPipeline?.name || ""); setSettingsStages(stages.join("\n")); setShowPipelineSettings(true); }}
              className="p-2 text-muted hover:text-ink border border-border rounded-lg hover:bg-cream transition-colors" title="Pipeline settings">
              <Settings01Icon size={16} />
            </button>
          )}
          <button onClick={() => setShowNewPipeline(true)} className="btn btn-primary btn-sm">+ Pipeline</button>
          {selectedPipelineId && stages.length > 0 && (
            <button onClick={() => { setNewDealStage(stages[0] || ""); setShowNewDeal(true); }} className="btn btn-primary btn-sm">+ Deal</button>
          )}
        </div>
      </div>

      {pipelines.length === 0 ? (
        <div className="empty-state">
          <h3>No pipelines yet</h3>
          <p className="text-sm text-muted mt-1">Create a pipeline to start tracking deals.</p>
          <button onClick={() => setShowNewPipeline(true)} className="btn btn-primary btn-sm mt-4">Create Pipeline</button>
        </div>
      ) : stages.length === 0 ? (
        <div className="empty-state"><h3>No stages configured</h3><p className="text-sm text-muted mt-1">Open pipeline settings to add stages.</p></div>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-2">Positive / Progressing</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {positiveStages.filter(s => stages.includes(s)).map(stage => renderColumn(stage, stage === "won" ? "bg-green-500" : "bg-purple-500"))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-2">Negative / Dead Ends</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {negativeStages.filter(s => stages.includes(s)).map(stage => renderColumn(stage, "bg-red-400"))}
            </div>
          </div>
        </div>
      )}

      {/* Deal detail slide-over */}
      {editDeal && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setEditDeal(null)}>
          <div className="w-full sm:max-w-md bg-cream border-l border-border shadow-2xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">{editDeal.name}</h2>
                <button onClick={() => setEditDeal(null)} className="text-muted-2 hover:text-blue-accent flex items-center justify-center">
                  <Cancel01Icon size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Pipeline</label>
                  <p className="text-sm text-ink">{editDeal.pipeline.name}</p>
                </div>
                {editDeal.lead && (
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wider block mb-1">Linked Lead</label>
                    <div className="bg-cream border border-border rounded-lg p-3">
                      <p className="text-sm font-medium text-ink">{[editDeal.lead.firstName, editDeal.lead.lastName].filter(Boolean).join(" ") || editDeal.lead.email}</p>
                      <p className="text-xs text-muted mt-0.5">{editDeal.lead.email}</p>
                      {editDeal.lead.company && <p className="text-xs text-muted-2 mt-0.5">{editDeal.lead.company}</p>}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Stage</label>
                  <Select value={editDeal.stage} onChange={(s) => { updateDeal(editDeal.id, { stage: s }); setEditDeal({ ...editDeal, stage: s }); }}
                    options={stages.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                    placeholder="Select stage"
                    triggerClassName="w-full flex items-center justify-between gap-2 bg-cream border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-left"
                    matchWidth
                  />
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Status</label>
                  <div className="flex gap-2">
                    {["open", "won", "lost"].map(s => (
                      <button key={s} onClick={() => { updateDeal(editDeal.id, { status: s }); setEditDeal({ ...editDeal, status: s }); }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${editDeal.status === s ? "bg-ink text-white border-ink" : "bg-cream text-muted border-border hover:text-blue-accent"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Value ($)</label>
                  <input value={editValue} onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { const v = parseFloat(editValue) || 0; updateDeal(editDeal.id, { value: v }); setEditDeal({ ...editDeal, value: v }); }}
                    className="w-full bg-cream border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Notes</label>
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                    onBlur={() => updateDeal(editDeal.id, { notes: editNotes })}
                    rows={4} className="w-full bg-cream border border-border rounded-lg p-3 text-sm outline-none focus:border-blue-accent resize-y" placeholder="Add notes about this deal..." />
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Created</label>
                  <p className="text-sm text-muted">{new Date(editDeal.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-border">
                <button onClick={async () => { await fetch(`/api/deals?id=${editDeal.id}`, { method: "DELETE" }); setDeals(prev => prev.filter(d => d.id !== editDeal.id)); setEditDeal(null); showToast("Deal deleted"); }}
                  className="text-xs text-red-600 hover:underline">Delete deal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Deal modal */}
      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewDeal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">New Deal</h2>
            <div className="space-y-3">
              <Select value={newDealLeadId} onChange={(id) => {
                setNewDealLeadId(id);
                if (id) { const l = leads.find(l => l.id === id); if (l) setNewDealName([l.firstName, l.lastName].filter(Boolean).join(" ") || l.email); }
              }}
                options={[{ value: "", label: "No lead (manual)" }, ...leads.map(l => ({ value: l.id, label: `${[l.firstName, l.lastName].filter(Boolean).join(" ") || l.email}${l.company ? ` — ${l.company}` : ""}` }))]}
                placeholder="Link a lead (optional)"
                triggerClassName="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-left"
                matchWidth
                searchable
              />
              <input value={newDealName} onChange={e => setNewDealName(e.target.value)} placeholder="Deal name"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" autoFocus />
              <input value={newDealValue} onChange={e => setNewDealValue(e.target.value)} placeholder="Value ($)" type="number"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
              <Select value={newDealStage} onChange={setNewDealStage}
                options={stages.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") }))}
                placeholder="Stage"
                triggerClassName="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent text-left"
                matchWidth
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNewDeal(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={createDeal} disabled={!newDealName.trim()} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* New Pipeline modal */}
      {showNewPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewPipeline(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">New Pipeline</h2>
            <div className="space-y-3">
              <input value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)} placeholder="Pipeline name"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" autoFocus />
              <div>
                <label className="text-xs text-muted block mb-1">Stages (one per line)</label>
                <textarea value={newPipelineStages} onChange={e => setNewPipelineStages(e.target.value)} rows={5}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent resize-y font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNewPipeline(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={createPipeline} disabled={!newPipelineName.trim()} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline settings modal */}
      {showPipelineSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowPipelineSettings(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Pipeline Settings</h2>
            <div className="space-y-3">
              <input value={settingsName} onChange={e => setSettingsName(e.target.value)} placeholder="Pipeline name"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent" />
              <div>
                <label className="text-xs text-muted block mb-1">Stages (one per line)</label>
                <textarea value={settingsStages} onChange={e => setSettingsStages(e.target.value)} rows={5}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent resize-y font-mono" />
              </div>
            </div>
            <div className="flex justify-between mt-5">
              <button onClick={() => { if (confirm("Delete this pipeline and all its deals?")) deletePipeline(); }}
                className="text-xs text-red-600 hover:underline">Delete pipeline</button>
              <div className="flex gap-2">
                <button onClick={() => setShowPipelineSettings(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
                <button onClick={savePipelineSettings} disabled={!settingsName.trim()} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
