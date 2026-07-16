"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConfirmModal from "@/components/confirm-modal";
import Select from "@/components/select";

type Lead = { id: string; email: string; firstName: string | null; lastName: string | null; company: string | null; title: string | null; phone: string | null; website: string | null; location: string | null; notes: string | null; campaignId: string | null; status: string; createdAt: string; campaign: { name: string } | null; };

const PROVIDERS: Record<string, { name: string; colors: string; logo: string }> = {
  gmail: { name: "Gmail", colors: "bg-[#3C4043]", logo: "M" },
  outlook: { name: "Outlook", colors: "bg-[#3C4043]", logo: "O" },
  hotmail: { name: "Outlook", colors: "bg-[#3C4043]", logo: "O" },
  live: { name: "Outlook", colors: "bg-[#3C4043]", logo: "O" },
  yahoo: { name: "Yahoo", colors: "bg-[#3C4043]", logo: "Y" },
  protonmail: { name: "Proton", colors: "bg-[#3C4043]", logo: "P" },
  proton: { name: "Proton", colors: "bg-[#3C4043]", logo: "P" },
  icloud: { name: "iCloud", colors: "bg-[#3C4043]", logo: "" },
  me: { name: "iCloud", colors: "bg-[#3C4043]", logo: "" },
  aol: { name: "AOL", colors: "bg-[#3C4043]", logo: "A" },
  zoho: { name: "Zoho", colors: "bg-[#3C4043]", logo: "Z" },
  yandex: { name: "Yandex", colors: "bg-[#3C4043]", logo: "Я" },
  fastmail: { name: "Fastmail", colors: "bg-[#3C4043]", logo: "F" },
  gmx: { name: "GMX", colors: "bg-[#3C4043]", logo: "G" },
  mail: { name: "Mail.com", colors: "bg-[#3C4043]", logo: "M" },
};

function getEmailProvider(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().split(".")[0] || "";
  return PROVIDERS[domain] || { name: "Other", colors: "bg-[#6B6578]", logo: "#" };
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCampaignId = searchParams.get("campaignId") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [importTab, setImportTab] = useState<"upload" | "link" | "type">("upload");
  const [manualEmails, setManualEmails] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importCampaignId, setImportCampaignId] = useState(urlCampaignId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const leadsUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
    Promise.all([
      fetch(leadsUrl).then(r => r.json()),
      fetch("/api/campaigns").then(r => r.json()),
    ]).then(([leadsData, campaignsData]) => {
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData.map((c: any) => ({ id: c.id, name: c.name })) : []);
      if (urlCampaignId) setShowImport(true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [urlCampaignId]);

  const columns = useMemo(() => {
    const has = (field: (l: Lead) => string | null) => leads.some(l => field(l)?.trim());
    return {
      firstName: has(l => l.firstName),
      lastName: has(l => l.lastName),
      company: has(l => l.company),
      title: has(l => l.title),
      phone: has(l => l.phone),
      website: has(l => l.website),
      location: has(l => l.location),
      notes: has(l => l.notes),
    };
  }, [leads]);

  const filtered = leads.filter(l =>
    l.email.toLowerCase().includes(search.toLowerCase()) ||
    (l.firstName || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.lastName || "").toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    if (res.ok) setLeads(prev => prev.filter(l => l.id !== id));
  }

  async function handleRemoveSelected() {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => fetch(`/api/leads?id=${id}`, { method: "DELETE" })));
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setSelectedIds(new Set());
  }

  async function handleRemoveAll() {
    const deleteUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads?all=true";
    await fetch(deleteUrl, { method: "DELETE" });
    setLeads([]);
    setSelectedIds(new Set());
    setShowConfirmAll(false);
  }

  async function handlePasteImport() {
    const lines = manualEmails.split(/[\n,]+/).map(l => l.trim()).filter(l => l.includes("@"));
    if (lines.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: lines.map(email => ({ email })), campaignId: importCampaignId || undefined }),
      });
      const result = await res.json();
      setImportResult(result);
      if (result.imported > 0) {
        const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
        const fresh = await fetch(freshUrl).then(r => r.json());
        setLeads(Array.isArray(fresh) ? fresh : []);
      }
    } catch {
      setImportResult({ error: "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  async function handleCsvImport() {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      if (importCampaignId) formData.append("campaignId", importCampaignId);
      const res = await fetch("/api/leads/import", { method: "POST", body: formData });
      const result = await res.json();
      setImportResult(result);
      if (result.imported > 0) {
        const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
        const fresh = await fetch(freshUrl).then(r => r.json());
        setLeads(Array.isArray(fresh) ? fresh : []);
      }
    } catch {
      setImportResult({ error: "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  async function handleLinkImport() {
    if (!linkUrl.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl, campaignId: importCampaignId || undefined }),
      });
      const result = await res.json();
      setImportResult(result);
      if (result.imported > 0) {
        const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
        const fresh = await fetch(freshUrl).then(r => r.json());
        setLeads(Array.isArray(fresh) ? fresh : []);
      }
    } catch {
      setImportResult({ error: "Failed to import from URL." });
    } finally {
      setImporting(false);
    }
  }

  const activeCampaign = urlCampaignId ? campaigns.find(c => c.id === urlCampaignId) : null;

  return (
    <>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Leads</h1>
          <p className="text-sm text-muted mt-1.5">{leads.length} total{activeCampaign ? ` in ${activeCampaign.name}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {leads.length > 0 && (
            <>
              {selectedIds.size > 0 && (
                <button onClick={handleRemoveSelected} className="btn btn-ghost btn-sm text-red-600 hover:text-red-600">Remove selected ({selectedIds.size})</button>
              )}
              <button onClick={() => setShowConfirmAll(true)} className="btn btn-ghost btn-sm text-red-600 hover:text-red-600">Remove all</button>
            </>
          )}
          <button onClick={() => { setShowImport(true); setImportResult(null); setCsvFile(null); setLinkUrl(""); }} className="btn btn-primary">+ Import Leads</button>
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <h3>No leads yet</h3>
            <p>Import leads to start building your outreach list.</p>
            <button onClick={() => { setShowImport(true); setImportResult(null); }} className="btn btn-primary">Import Leads</button>
          </div>
        ) : (
          <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4" />
                    </th>
                    <th>Email</th>
                    <th>Provider</th>
                    {columns.firstName && <th>First Name</th>}
                    {columns.lastName && <th>Last Name</th>}
                    {columns.company && <th>Company</th>}
                    {columns.title && <th>Title</th>}
                    {columns.phone && <th>Phone</th>}
                    {columns.website && <th>Website</th>}
                    {columns.location && <th>Location</th>}
                    {columns.notes && <th>Notes</th>}
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={99} className="text-center text-muted-2 py-12">No leads match your search</td></tr>
                  ) : filtered.map(l => {
                    const provider = getEmailProvider(l.email);
                    return (
                      <tr key={l.id}>
                        <td>
                          <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="w-4 h-4" />
                        </td>
                        <td className="font-medium">{l.email}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white ${provider.colors}`}>
                            <span className="text-[10px] leading-none">{provider.logo}</span>
                            {provider.name}
                          </span>
                        </td>
                        {columns.firstName && <td>{l.firstName}</td>}
                        {columns.lastName && <td>{l.lastName}</td>}
                        {columns.company && <td className="text-muted">{l.company}</td>}
                        {columns.title && <td className="text-muted">{l.title}</td>}
                        {columns.phone && <td className="text-muted">{l.phone}</td>}
                        {columns.website && <td className="text-muted">{l.website}</td>}
                        {columns.location && <td className="text-muted">{l.location}</td>}
                        {columns.notes && <td className="text-muted">{l.notes}</td>}
                        <td><span className={`badge ${l.status === "replied" ? "active" : l.status === "pending" ? "draft" : ""}`}>{l.status}</span></td>
                        <td>
                          <button onClick={() => handleRemove(l.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors font-medium">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowImport(false)}>
          <div className="bg-cream border border-border rounded-lg w-[90%] max-w-[520px] shadow-xl flex flex-col" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh" }}>
            <div className="flex justify-between items-center px-8 pt-7 pb-4 shrink-0">
              <h2 className="font-medium text-2xl font-normal">Import Leads</h2>
              <button onClick={() => setShowImport(false)} className="text-muted hover:text-blue-accent text-xl">✕</button>
            </div>

            <div className="flex gap-0 border-b border-border px-8">
              <button onClick={() => { setImportTab("upload"); setLinkUrl(""); setImportResult(null); }}
                className={`text-sm py-2.5 px-4 border-b-2 transition-colors ${importTab === "upload" ? "border-ink text-ink" : "border-transparent text-muted hover:text-blue-accent"}`}>
                Upload CSV
              </button>
              <button onClick={() => setImportTab("link")}
                className={`text-sm py-2.5 px-4 border-b-2 transition-colors ${importTab === "link" ? "border-ink text-ink" : "border-transparent text-muted hover:text-blue-accent"}`}>
                Import from Link
              </button>
              <button onClick={() => setImportTab("type")}
                className={`text-sm py-2.5 px-4 border-b-2 transition-colors ${importTab === "type" ? "border-ink text-ink" : "border-transparent text-muted hover:text-blue-accent"}`}>
                Type Manually
              </button>
            </div>

            <div className="px-8 pb-8 overflow-y-auto pt-6">
              {importResult && (
                <div className={`text-sm p-3 rounded-lg mb-4 ${importResult.error || importResult.firstError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {importResult.error || (importResult.firstError ? `${importResult.imported} imported, ${importResult.errors} errors (e.g. ${importResult.firstError})` : `${importResult.imported} imported, ${importResult.errors || 0} errors out of ${importResult.total}`)}
                </div>
              )}
              {importResult?.imported > 0 && importCampaignId && (
                <button onClick={() => router.push(`/dashboard/campaigns/${importCampaignId}`)} className="btn btn-primary w-full mb-4">Continue to Campaign</button>
              )}

              {/* Campaign selector */}
              <div className="mb-4">
                <label className="block text-xs text-muted mb-2">Assign to campaign (optional)</label>
                <Select value={importCampaignId} onChange={setImportCampaignId}
                  options={[{ value: "", label: "No campaign" }, ...campaigns.map(c => ({ value: c.id, label: c.name }))]}
                  placeholder="No campaign" />
              </div>

              {importTab === "upload" ? (
                <div>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setCsvFile(file);
                  }} />
                  <div className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-muted-2 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    {csvFile ? (
                      <div>
                        <p className="text-sm font-medium text-ink">{csvFile.name}</p>
                        <p className="text-xs text-muted mt-1">{(csvFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-muted-2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p className="text-sm text-muted mb-1">Drop your CSV here or click to browse</p>
                        <span className="text-xs text-muted-2">Auto-detects: email, firstName, lastName, company, title, phone, website, location (city/state/country), personalization, notes</span>
                      </div>
                    )}
                  </div>
                  <button onClick={handleCsvImport} disabled={!csvFile || importing} className="btn btn-primary w-full mt-5 disabled:opacity-40">
                    {importing ? "Importing..." : "Import CSV"}
                  </button>
                </div>
              ) : importTab === "link" ? (
                <div>
                  <div className="field-group">
                    <label className="block text-xs text-muted mb-2">Paste a CSV URL</label>
                    <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                      className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-ink" />
                    <p className="text-xs text-muted-2 mt-2">Publish your sheet to the web (File → Share → Publish to web → CSV), then paste the URL.</p>
                  </div>
                  <button onClick={handleLinkImport} disabled={!linkUrl.trim() || importing} className="btn btn-primary w-full mt-5 disabled:opacity-40">
                    {importing ? "Importing..." : "Fetch & Import"}
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-muted mb-2">Type email addresses</label>
                  <textarea value={manualEmails} onChange={e => setManualEmails(e.target.value)}
                    placeholder={`alice@example.com\nbob@example.com\ncharlie@example.com`}
                    className="w-full h-40 bg-cream-2 border border-border rounded-lg p-4 text-sm outline-none focus:border-blue-accent focus:ring-1 focus:ring-blue-accent/20 transition-all placeholder:text-muted-2 font-mono resize-none" />
                  <p className="text-xs text-muted-2 mt-1.5">One email per line. Each line must contain a valid email address.</p>
                  <button onClick={handlePasteImport} disabled={!manualEmails.trim() || importing} className="btn btn-primary w-full mt-4 disabled:opacity-40">
                    {importing ? "Importing..." : `Import${manualEmails.trim() ? ` (${manualEmails.split(/[\n,]+/).map(l => l.trim()).filter(l => l.includes("@")).length} detected)` : ""}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={showConfirmAll}
        title="Remove all leads?"
        message={urlCampaignId ? "This will permanently delete all leads from this campaign." : "This will permanently delete all leads from your account."}
        confirmLabel="Remove all"
        onConfirm={handleRemoveAll}
        onCancel={() => setShowConfirmAll(false)}
        variant="danger"
      />
    </>
  );
}
