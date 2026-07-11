"use client";

import { useState, useEffect } from "react";

interface PipelineData { id: string; name: string; stages: string; _count: { deals: number } }
interface DealData { id: string; name: string; value: number; stage: string; status: string; notes: string | null; leadId: string | null; pipeline: { name: string }; _count: { tasks: number }; createdAt: string }

export default function CrmPage() {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [editDeal, setEditDeal] = useState<DealData | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/crm/seed", { method: "POST" });
        if (res.ok) {
          const seeded = await res.json();
          setPipelines(seeded.pipelines);
          setSelectedPipelineId(seeded.pipelineId);
        } else {
          console.error("Seed failed", res.status, await res.text());
          // Fallback: try fetching existing pipelines
          const pipes = await fetch("/api/pipelines").then(r => r.ok && r.json());
          if (pipes?.length > 0) {
            setPipelines(pipes);
            setSelectedPipelineId(pipes[0].id);
          }
        }
      } catch (err) {
        console.error("Seed error", err);
      }
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
    if (dragId) {
      updateDeal(dragId, { stage: newStage });
      setDragId(null);
    }
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
              className="bg-cream border border-border rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow draggable">
              <p className="text-sm font-medium text-ink leading-snug mb-1">{deal.name}</p>
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[clamp(24px,3vw,32px)] font-medium tracking-tight">CRM</h1>
        <select value={selectedPipelineId} onChange={e => setSelectedPipelineId(e.target.value)}
          className="bg-cream border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent">
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {pipelines.length === 0 ? (
        <div className="empty-state"><h3>No pipelines yet</h3><p>Create a pipeline to start tracking deals.</p></div>
      ) : stages.length === 0 ? (
        <div className="empty-state"><h3>No stages configured</h3></div>
      ) : (
        <div className="space-y-8">
          {/* Positive / Progressing */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-2">Positive / Progressing</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {positiveStages.filter(s => stages.includes(s)).map(stage => renderColumn(stage, stage === "won" ? "bg-green-500" : "bg-purple-500"))}
            </div>
          </div>
          {/* Negative / Dead Ends */}
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
          <div className="w-full max-w-md bg-cream border-l border-border shadow-2xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">{editDeal.name}</h2>
                <button onClick={() => setEditDeal(null)} className="text-muted-2 hover:text-blue-accent text-lg leading-none">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Pipeline</label>
                  <p className="text-sm text-ink">{editDeal.pipeline.name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1">Stage</label>
                  <select value={editDeal.stage} onChange={e => { const s = e.target.value; updateDeal(editDeal.id, { stage: s }); setEditDeal({ ...editDeal, stage: s }); }}
                    className="w-full bg-cream border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent">
                    {stages.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
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
                <button onClick={async () => { await fetch(`/api/deals?id=${editDeal.id}`, { method: "DELETE" }); setDeals(prev => prev.filter(d => d.id !== editDeal.id)); setEditDeal(null); }}
                  className="text-xs text-red-600 hover:underline">Delete deal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
