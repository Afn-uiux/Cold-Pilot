"use client";

import { useState, useEffect } from "react";

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
  { value: "calendly", label: "Calendly", desc: "Automated meeting booking links" },
];

export default function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [provider, setProvider] = useState("slack");
  const [config, setConfig] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) setIntegrations(await res.json());
    setLoading(false);
  }

  async function connect() {
    if (!config.trim()) return;
    let parsed: any;
    if (provider === "calendly") {
      parsed = { link: config.trim() };
    } else {
      try { parsed = JSON.parse(config); } catch { parsed = { webhookUrl: config }; }
    }
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, config: parsed }),
    });
    setConfig("");
    setShowConnect(false);
    load();
  }

  async function disconnect(id: string) {
    await fetch(`/api/integrations?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Integrations</h3>
        <button onClick={() => setShowConnect(true)} className="bg-blue-accent text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          Connect
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : integrations.length === 0 ? (
        <p className="text-xs text-muted-2">No integrations connected. Connect Slack, HubSpot, or Calendly.</p>
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
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-blue-accent"
            >
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>)}
            </select>
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
            {provider === "calendly" && (
              <input
                value={config}
                onChange={e => setConfig(e.target.value)}
                placeholder="https://calendly.com/yourname/30min"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
              />
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConnect(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">Cancel</button>
              <button onClick={connect} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
