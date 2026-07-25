"use client";

import { useState, useEffect } from "react";
import ConfirmModal from "@/components/confirm-modal";
import { useToast } from "@/components/toast";

type Template = { id: string; name: string; subject: string; bodyHtml: string; updatedAt: string; };

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("My Template");
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(data => { setTemplates(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName || !newSubject) return;
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, subject: newSubject, bodyHtml: "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(prev => [data, ...prev]);
        setShowCreate(false);
        setNewName("My Template");
        setNewSubject("");
        toast("Template created", "success");
      }
    } catch {}
    setCreating(false);
  }

  async function doDelete(id: string) {
    const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast("Template deleted", "success");
    } else {
      toast("Failed to delete template", "error");
    }
    setConfirmDelete(null);
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Templates</h1>
          <p className="text-sm text-muted mt-1.5">{templates.length} saved</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">New Template</button>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <h3>No templates yet</h3>
            <p>Create your first template to reuse across campaigns.</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">New Template</button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {templates.map(t => (
              <div key={t.id} className="border border-border rounded-lg p-5 bg-cream cursor-pointer hover:border-blue-accent transition-colors flex flex-col justify-between">
                <div>
                  <h3 className="font-medium text-xl font-normal mb-2">{t.name}</h3>
                  <div className="font-medium text-[11px] text-muted-2 mb-3">{t.subject}</div>
                  <p className="text-sm text-muted leading-relaxed line-clamp-3">{t.bodyHtml.replace(/<[^>]*>/g, "").slice(0, 150)}</p>
                </div>
                <div className="flex items-center justify-between font-medium text-[11px] text-muted-2 mt-4">
                  <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(t.id); }}
                    className="text-red-500 hover:text-red-700 transition-colors">Delete</button>
                </div>
              </div>
            ))}
            <div onClick={() => setShowCreate(true)} className="border-2 border-dashed border-border rounded-lg p-5 flex items-center justify-center cursor-pointer hover:border-blue-accent transition-colors">
              <div className="text-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-muted-2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span className="text-sm text-muted">New template</span>
              </div>
            </div>
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
            <h2 className="font-medium text-2xl font-normal mb-6">Create a new template</h2>
            <div className="field-group mb-5">
              <label className="block text-xs text-muted mb-2">Template Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full bg-transparent border-b border-border pb-2.5 text-lg outline-none focus:border-ink transition-colors font-medium" />
            </div>
            <div className="field-group mb-5">
              <label className="block text-xs text-muted mb-2">Subject Line</label>
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                className="w-full bg-transparent border-b border-border pb-2.5 text-lg outline-none focus:border-ink transition-colors font-medium" />
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !newName || !newSubject} className="btn btn-primary flex-1">{creating ? "Creating..." : "Create Template"}</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirmDelete}
        title="Delete template?"
        message="This template will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        variant="danger"
      />
    </div>
  );
}
