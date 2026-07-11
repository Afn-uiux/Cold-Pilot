"use client";

import { useState, useEffect } from "react";

interface Suppression {
  id: string;
  email: string;
  reason: string;
  type: string;
  createdAt: string;
}

export default function SuppressionsPage() {
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
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Suppressions</h1>
          <p className="text-sm text-muted mt-0.5">Blocked emails that will never be sent to</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Add Email
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : suppressions.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-2 text-sm">No suppressed emails</p>
          <p className="text-muted text-xs mt-1">When emails hard-bounce they are auto-suppressed</p>
        </div>
      ) : (
        <div className="space-y-1">
          {suppressions.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3 px-4 bg-cream border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <div>
                  <p className="text-sm font-medium">{s.email}</p>
                  <p className="text-xs text-muted">{s.reason} &middot; {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => removeSuppression(s.id)}
                className="text-xs text-muted hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Suppress Email</h2>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-blue-accent"
            />
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted hover:text-blue-accent transition-colors">Cancel</button>
              <button onClick={addSuppression} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Suppress</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
