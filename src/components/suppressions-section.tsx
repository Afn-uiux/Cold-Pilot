"use client";

import { useState, useEffect } from "react";
import { CircleXIcon } from "@/components/icons/circle-x";

interface Suppression {
  id: string;
  email: string;
  reason: string;
  type: string;
  createdAt: string;
}

export default function SuppressionsSection() {
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/suppressions");
    if (res.ok) setSuppressions(await res.json());
    setLoading(false);
  }

  async function addSuppression() {
    if (!email) return;
    const res = await fetch("/api/suppressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reason: reason || "Manual", type: "manual" }),
    });
    if (res.ok) {
      setShowModal(false);
      setEmail("");
      setReason("");
      load();
    }
  }

  async function removeSuppression(id: string) {
    await fetch(`/api/suppressions?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setShowModal(true)} className="bg-blue-accent text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          Add Email
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : suppressions.length === 0 ? (
        <p className="text-xs text-muted-2">No suppressed emails. Hard bounces are auto-suppressed.</p>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {suppressions.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-cream border border-border rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <CircleXIcon size={12} className="flex-shrink-0" style={{ color: "#ef4444" }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{s.email}</p>
                  <p className="text-[10px] text-muted">{s.reason} &middot; {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => removeSuppression(s.id)} className="text-[10px] text-muted hover:text-red-500 flex-shrink-0 ml-2">Remove</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Suppress Email</h2>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-blue-accent" />
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={addSuppression} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Suppress</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
