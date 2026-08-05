"use client";

import { useState, useEffect } from "react";

interface Webhook {
  id: string;
  url: string;
  events: string;
  active: boolean;
  lastStatus: number | null;
  createdAt: string;
}

export default function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/webhooks");
    if (res.ok) setWebhooks(await res.json());
    setLoading(false);
  }

  async function createWebhook() {
    if (!url.trim()) return;
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setUrl("");
    setShowCreate(false);
    load();
  }

  async function toggleWebhook(id: string, active: boolean) {
    await fetch("/api/webhooks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    load();
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Webhooks</h3>
        <button onClick={() => setShowCreate(true)} className="bg-blue-accent text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          Add Webhook
        </button>
      </div>

      <p className="text-xs text-muted mb-4">Send HTTP POST requests when events happen (opens, clicks, replies, bounces, unsubscribes)</p>

      {loading ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : webhooks.length === 0 ? (
        <p className="text-xs text-muted-2">No webhooks configured. Add one to receive event callbacks.</p>
      ) : (
        <div className="space-y-2">
          {webhooks.map(w => (
            <div key={w.id} className="flex items-center justify-between py-2.5 px-3 bg-cream border border-border rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{w.url}</p>
                <p className="text-xs text-muted">
                  {w.events} &middot;
                  {w.lastStatus !== null ? (w.lastStatus >= 200 && w.lastStatus < 300 ? " OK" : ` HTTP ${w.lastStatus}`) : " Not fired yet"}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => toggleWebhook(w.id, !w.active)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${w.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {w.active ? "Active" : "Paused"}
                </button>
                <button onClick={() => deleteWebhook(w.id)} className="text-xs text-muted hover:text-red-500 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Add Webhook</h2>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
              onKeyDown={e => e.key === "Enter" && createWebhook()}
            />
            <p className="text-xs text-muted mb-4">Will receive POST requests for open, click, reply, bounce, and unsubscribe events.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={createWebhook} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
