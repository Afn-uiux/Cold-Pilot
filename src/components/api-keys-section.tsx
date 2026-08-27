"use client";

import { useState, useEffect } from "react";
import { Cancel01Icon } from "@/components/icons/cancel-01";

interface ApiKey {
  id: string;
  name: string;
  scopes: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/api-keys");
    if (res.ok) setKeys(await res.json());
    setLoading(false);
  }

  async function createKey() {
    if (!name.trim()) return;
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.key);
      setName("");
      setShowCreate(false);
      load();
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold">API Keys</h3>
        <button onClick={() => setShowCreate(true)} className="bg-blue-accent text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shrink-0">
          Create Key
        </button>
      </div>

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 relative">
          <button onClick={() => setNewKey("")} className="absolute top-2 right-2 text-green-600 hover:text-green-800"><Cancel01Icon size={14} /></button>
          <p className="text-xs font-medium text-green-800 mb-1">Key created — copy it now, you won't see it again:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white px-2 py-1 rounded border border-green-200 break-all select-all">{newKey}</code>
            <button onClick={async () => { await navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs text-blue-accent hover:underline shrink-0">{copied ? "Copied!" : "Copy"}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-muted-2">No API keys yet. Create one to access the API programmatically.</p>
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-3 bg-cream border border-border rounded-lg gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted truncate">{k.scopes} &middot; {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"} &middot; Created {new Date(k.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => deleteKey(k.id)} className="text-xs text-muted hover:text-red-500 transition-colors shrink-0 self-start sm:self-center">Delete</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Create API Key</h2>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
              onKeyDown={e => e.key === "Enter" && createKey()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={createKey} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
