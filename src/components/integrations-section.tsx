"use client";

import { useState, useEffect } from "react";
import Select from "@/components/select";

interface Integration {
  id: string;
  provider: string;
  label: string | null;
  active: boolean;
  createdAt: string;
}

const PROVIDERS = [
  { value: "slack", label: "Slack", desc: "Send notifications to a Slack channel" },
  { value: "hubspot", label: "HubSpot", desc: "Sync contacts and log activities" },
];

export default function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [provider, setProvider] = useState("slack");
  const [config, setConfig] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) setIntegrations(await res.json());
    setLoading(false);
  }

  async function connect() {
    if (!config.trim() || connecting) return;
    setConnecting(true);
    let parsed: any;
    try { parsed = JSON.parse(config); } catch { parsed = { webhookUrl: config }; }
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, config: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to connect");
        setConnecting(false);
        return;
      }
      setConfig("");
      setShowConnect(false);
      showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected`);
      load();
    } catch {
      showToast("Connection failed");
    }
    setConnecting(false);
  }

  async function disconnect(id: string) {
    await fetch(`/api/integrations?id=${id}`, { method: "DELETE" });
    showToast("Disconnected");
    load();
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg transition-all">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Integrations</h3>
        <button onClick={() => setShowConnect(true)} className="bg-blue-accent text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          Connect
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : integrations.length === 0 ? (
        <p className="text-xs text-muted-2">No integrations connected. Connect Slack or HubSpot.</p>
      ) : (
        <div className="space-y-2">
          {integrations.map(i => (
            <div key={i.id} className="flex items-center justify-between py-2.5 px-3 bg-cream border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium capitalize">{i.label || i.provider}</p>
                <p className="text-xs text-muted">{i.provider} &middot; Connected {new Date(i.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => disconnect(i.id)} className="text-xs text-muted hover:text-red-500 transition-colors">Disconnect</button>
            </div>
          ))}
        </div>
      )}

      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowConnect(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Connect Integration</h2>
            <Select
              value={provider}
              onChange={setProvider}
              options={PROVIDERS.map(p => ({ value: p.value, label: `${p.label} — ${p.desc}` }))}
              placeholder="Select provider"
              className="mb-3"
              triggerClassName="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-accent bg-transparent text-left"
              matchWidth
            />
            {provider === "slack" && (
              <input
                value={config}
                onChange={e => setConfig(e.target.value)}
                placeholder="Slack webhook URL (https://hooks.slack.com/...)"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
              />
            )}
            {provider === "hubspot" && (
              <input
                value={config}
                onChange={e => setConfig(e.target.value)}
                placeholder="HubSpot API Key"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
              />
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConnect(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={connect} disabled={connecting} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{connecting ? "Connecting..." : "Connect"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
