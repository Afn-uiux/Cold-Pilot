"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ConfirmModal from "@/components/confirm-modal";
import Select from "@/components/select";
import { Search01Icon } from "@/components/icons/search-01";
import { Upload01Icon } from "@/components/icons/upload-01";
import { Cancel01Icon } from "@/components/icons/cancel-01";
import { useToast } from "@/components/toast";
import VerificationStatusBadge from "@/components/verification-status-badge";

type Lead = { id: string; email: string; firstName: string | null; lastName: string | null; company: string | null; title: string | null; phone: string | null; website: string | null; location: string | null; notes: string | null; customFields: string | null; campaignId: string | null; status: string; verificationStatus: string | null; createdAt: string; campaign: { name: string } | null; };

const PROVIDERS: Record<string, { name: string; colors: string; logo?: string; glyph: string }> = {
  gmail: { name: "Gmail", colors: "bg-white border border-border", logo: "/provider-logos/gmail.png", glyph: "M" },
  outlook: { name: "Outlook", colors: "bg-white border border-border", logo: "/provider-logos/outlook.png", glyph: "O" },
  hotmail: { name: "Outlook", colors: "bg-white border border-border", logo: "/provider-logos/outlook.png", glyph: "O" },
  live: { name: "Outlook", colors: "bg-white border border-border", logo: "/provider-logos/outlook.png", glyph: "O" },
  yahoo: { name: "Yahoo", colors: "bg-white border border-border", logo: "/provider-logos/yahoo.png", glyph: "Y" },
  protonmail: { name: "Proton", colors: "bg-white border border-border", logo: "/provider-logos/proton.png", glyph: "P" },
  proton: { name: "Proton", colors: "bg-white border border-border", logo: "/provider-logos/proton.png", glyph: "P" },
  icloud: { name: "iCloud", colors: "bg-white border border-border", logo: "/provider-logos/apple.png", glyph: "A" },
  me: { name: "iCloud", colors: "bg-white border border-border", logo: "/provider-logos/apple.png", glyph: "A" },
  aol: { name: "AOL", colors: "bg-white border border-border", logo: "/provider-logos/aol.png", glyph: "A" },
  zoho: { name: "Zoho", colors: "bg-white border border-border", logo: "/provider-logos/zoho.png", glyph: "Z" },
  yandex: { name: "Yandex", colors: "bg-white border border-border", logo: "/provider-logos/yandex.png", glyph: "Я" },
  fastmail: { name: "Fastmail", colors: "bg-white border border-border", logo: "/provider-logos/fastmail.png", glyph: "F" },
  gmx: { name: "GMX", colors: "bg-white border border-border", logo: "/provider-logos/gmx.png", glyph: "G" },
  mail: { name: "Mail.com", colors: "bg-white border border-border", logo: "/provider-logos/mail.png", glyph: "M" },
  mailru: { name: "Mail.ru", colors: "bg-white border border-border", logo: "/provider-logos/mailru.png", glyph: "M" },
  inbox: { name: "Mail.ru", colors: "bg-white border border-border", logo: "/provider-logos/mailru.png", glyph: "M" },
  list: { name: "Mail.ru", colors: "bg-white border border-border", logo: "/provider-logos/mailru.png", glyph: "M" },
  tutanota: { name: "Tuta", colors: "bg-white border border-border", logo: "/provider-logos/tutanota.png", glyph: "T" },
  tutamail: { name: "Tuta", colors: "bg-white border border-border", logo: "/provider-logos/tutanota.png", glyph: "T" },
  "163": { name: "163", colors: "bg-white border border-border", logo: "/provider-logos/163.png", glyph: "1" },
  "126": { name: "126", colors: "bg-white border border-border", logo: "/provider-logos/126.png", glyph: "1" },
  web: { name: "Web.de", colors: "bg-white border border-border", logo: "/provider-logos/webde.png", glyph: "W" },
  "t-online.de": { name: "T-Online", colors: "bg-white border border-border", logo: "/provider-logos/tonline.png", glyph: "T" },
  freenet: { name: "Freenet", colors: "bg-white border border-border", logo: "/provider-logos/freenet.png", glyph: "F" },
  free: { name: "Free", colors: "bg-white border border-border", logo: "/provider-logos/free.png", glyph: "F" },
  orange: { name: "Orange", colors: "bg-white border border-border", logo: "/provider-logos/orange.png", glyph: "O" },
  laposte: { name: "La Poste", colors: "bg-white border border-border", logo: "/provider-logos/laposte.png", glyph: "L" },
  sfr: { name: "SFR", colors: "bg-white border border-border", logo: "/provider-logos/sfr.png", glyph: "S" },
  qq: { name: "QQ", colors: "bg-white border border-border", logo: "/provider-logos/qq.png", glyph: "Q" },
  naver: { name: "Naver", colors: "bg-white border border-border", logo: "/provider-logos/naver.png", glyph: "N" },
  daum: { name: "Daum", colors: "bg-white border border-border", logo: "/provider-logos/daum.png", glyph: "D" },
  rediffmail: { name: "Rediffmail", colors: "bg-white border border-border", logo: "/provider-logos/rediff.png", glyph: "R" },
  indiatimes: { name: "Indiatimes", colors: "bg-white border border-border", logo: "/provider-logos/indiatimes.png", glyph: "I" },
  rambler: { name: "Rambler", colors: "bg-white border border-border", logo: "/provider-logos/rambler.png", glyph: "R" },
  uol: { name: "UOL", colors: "bg-white border border-border", logo: "/provider-logos/uol.png", glyph: "U" },
  bol: { name: "BOL", colors: "bg-white border border-border", logo: "/provider-logos/bol.png", glyph: "B" },
  hey: { name: "Hey", colors: "bg-white border border-border", logo: "/provider-logos/hey.png", glyph: "H" },
  hushmail: { name: "Hushmail", colors: "bg-white border border-border", logo: "/provider-logos/hushmail.png", glyph: "H" },
  startmail: { name: "StartMail", colors: "bg-white border border-border", logo: "/provider-logos/startmail.png", glyph: "S" },
  posteo: { name: "Posteo", colors: "bg-white border border-border", logo: "/provider-logos/posteo.png", glyph: "P" },
  mailbox: { name: "Mailbox.org", colors: "bg-white border border-border", logo: "/provider-logos/mailbox.png", glyph: "M" },
  netzero: { name: "NetZero", colors: "bg-white border border-border", logo: "/provider-logos/netzero.png", glyph: "N" },
  juno: { name: "Juno", colors: "bg-white border border-border", logo: "/provider-logos/juno.png", glyph: "J" },
  lycos: { name: "Lycos", colors: "bg-white border border-border", logo: "/provider-logos/lycos.png", glyph: "L" },
  excite: { name: "Excite", colors: "bg-white border border-border", logo: "/provider-logos/excite.png", glyph: "E" },
  mailfence: { name: "Mailfence", colors: "bg-white border border-border", logo: "/provider-logos/mailfence.png", glyph: "M" },
  runbox: { name: "Runbox", colors: "bg-white border border-border", logo: "/provider-logos/runbox.png", glyph: "R" },
  countermail: { name: "CounterMail", colors: "bg-white border border-border", logo: "/provider-logos/countermail.png", glyph: "C" },
};

function getEmailProvider(email: string) {
  const fullDomain = email.split("@")[1]?.toLowerCase() || "";
  const first = fullDomain.split(".")[0] || "";
  const provider = PROVIDERS[fullDomain] || PROVIDERS[first];
  return provider || { name: "Other", colors: "bg-white border border-border", glyph: "#" };
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlCampaignId = searchParams.get("campaignId") || "";
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showConfirmSelected, setShowConfirmSelected] = useState(false);
  const [importTab, setImportTab] = useState<"upload" | "link" | "type">("upload");
  const [manualEmails, setManualEmails] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importCampaignId, setImportCampaignId] = useState(urlCampaignId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [verifyResult, setVerifyResult] = useState<{
    error?: string;
    valid?: number;
    invalid?: number;
    risky?: number;
    catch_all?: number;
    unknown?: number;
  } | null>(null);

  useEffect(() => {
    const leadsUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
    Promise.all([
      fetch(leadsUrl).then(r => r.json()),
      fetch("/api/campaigns").then(r => r.json()),
    ]).then(([leadsData, campaignsData]) => {
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData.map((c: any) => ({ id: c.id, name: c.name })) : []);
      if (urlCampaignId && (!Array.isArray(leadsData) || leadsData.length === 0)) setShowImport(true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [urlCampaignId]);

  const columns = useMemo(() => {
    const has = (field: (l: Lead) => string | null) => leads.some(l => field(l)?.trim());
    const customKeys = new Set<string>();
    for (const l of leads) {
      if (l.customFields) {
        try { Object.keys(JSON.parse(l.customFields)).forEach(k => { const c = k.toLowerCase().replace(/[^\w]/g,""); if (c !== "email" && c !== "emailaddress" && c !== "e-mail" && c !== "emails") customKeys.add(k); }); } catch {}
      }
    }
    return {
      firstName: has(l => l.firstName),
      lastName: has(l => l.lastName),
      company: has(l => l.company),
      title: has(l => l.title),
      phone: has(l => l.phone),
      website: has(l => l.website),
      location: has(l => l.location),
      notes: has(l => l.notes),
      customKeys: Array.from(customKeys),
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
    setConfirmDelete(id);
  }

  async function doRemove(id: string) {
    const res = await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.id !== id));
      toast("Lead deleted", "success");
    } else {
      toast("Failed to delete lead", "error");
    }
    setConfirmDelete(null);
  }

  async function handleRemoveSelected() {
    setShowConfirmSelected(true);
  }

  async function doRemoveSelected() {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => fetch(`/api/leads?id=${id}`, { method: "DELETE" })));
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setSelectedIds(new Set());
    toast(`${ids.length} lead${ids.length > 1 ? "s" : ""} deleted`, "success");
    setShowConfirmSelected(false);
  }

  async function handleRemoveAll() {
    const deleteUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads?all=true";
    await fetch(deleteUrl, { method: "DELETE" });
    setLeads([]);
    setSelectedIds(new Set());
    setShowConfirmAll(false);
    toast("All leads removed", "info");
  }

  async function handleVerifyAll() {
    setVerifying(true);
    setVerifyResult(null);
    const idsToVerify = selectedIds.size > 0
      ? Array.from(selectedIds)
      : leads.filter(l => !l.verificationStatus || l.verificationStatus === "unverified").map(l => l.id);
    setVerifyingIds(new Set(idsToVerify));
    try {
      const leadIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const body = leadIds
        ? { leadIds }
        : urlCampaignId ? { campaignId: urlCampaignId } : {};
      if (!leadIds && !urlCampaignId) {
        setVerifyResult({ error: "Select leads or filter by a campaign first" });
        return;
      }
      const res = await fetch("/api/leads/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      setVerifyResult(result);
      const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
      const fresh = await fetch(freshUrl).then(r => r.json());
      setLeads(Array.isArray(fresh) ? fresh : []);
    } catch {
      setVerifyResult({ error: "Verification failed" });
    } finally {
      setVerifying(false);
      setVerifyingIds(new Set());
    }
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
      if (!result.error && !result.firstError) {
        setResultAndClose(result);
        const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
        const fresh = await fetch(freshUrl).then(r => r.json());
        setLeads(Array.isArray(fresh) ? fresh : []);
      } else {
        setImportResult(result);
      }
    } catch {
      setImportResult({ error: "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  function setResultAndClose(result: { imported?: number; error?: string; firstError?: string }) {
    if (!result.error && !result.firstError) {
      setShowImport(false);
      setImportResult(null);
      setImportCampaignId("");
      toast(`${result.imported ?? 0} lead${(result.imported ?? 0) === 1 ? "" : "s"} imported`, "success");
      if (urlCampaignId) router.replace(`/dashboard/campaigns/${urlCampaignId}?tab=leads`);
    } else {
      setImportResult(result);
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
      if (!result.error && !result.firstError) {
        setResultAndClose(result);
        const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
        const fresh = await fetch(freshUrl).then(r => r.json());
        setLeads(Array.isArray(fresh) ? fresh : []);
      } else {
        setImportResult(result);
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
      if (!result.error && !result.firstError) {
        setResultAndClose(result);
        const freshUrl = urlCampaignId ? `/api/leads?campaignId=${urlCampaignId}` : "/api/leads";
        const fresh = await fetch(freshUrl).then(r => r.json());
        setLeads(Array.isArray(fresh) ? fresh : []);
      } else {
        setImportResult(result);
      }
    } catch (e: any) {
      setImportResult({ error: e?.message || "Failed to import from URL." });
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
              <button onClick={handleVerifyAll} disabled={verifying} className="btn btn-ghost btn-sm text-blue-accent hover:text-blue-accent disabled:opacity-40">
                {verifying ? "Verifying..." : "Verify" + (selectedIds.size > 0 ? ` (${selectedIds.size})` : " All")}
              </button>
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
              <Search01Icon size={14} className="pointer-events-none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7A9AB5" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." />
            </div>
          </div>
        </div>

        {verifyResult && !verifyResult.error && (
          <div className="text-sm p-3 rounded-lg mb-4 bg-blue-50 text-blue-700">
            Verified: {verifyResult.valid} valid, {(verifyResult.invalid || 0) + (verifyResult.risky || 0)} do not contact, {verifyResult.catch_all || 0} catch-all, {verifyResult.unknown} unknown
          </div>
        )}
        {verifyResult?.error && (
          <div className="text-sm p-3 rounded-lg mb-4 bg-red-50 text-red-700">{verifyResult.error}</div>
        )}

        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading leads...</div>
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
                    <th className="w-10">#</th>
                    <th className="w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4" />
                    </th>
                    <th>Email</th>
                    <th>Provider</th>
                    {columns.customKeys.length > 0 ? (
                      columns.customKeys.map(k => <th key={k}>{k}</th>)
                    ) : (
                      <>
                        {columns.firstName && <th>First Name</th>}
                        {columns.lastName && <th>Last Name</th>}
                        {columns.company && <th>Company</th>}
                        {columns.title && <th>Title</th>}
                        {columns.phone && <th>Phone</th>}
                        {columns.website && <th>Website</th>}
                        {columns.location && <th>Location</th>}
                        {columns.notes && <th>Notes</th>}
                      </>
                    )}
                    <th>Status</th>
                    <th>Verification</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={99} className="text-center text-muted-2 py-12">No leads match your search</td></tr>
                  ) : filtered.map((l, i) => {
                    const provider = getEmailProvider(l.email);
                    let parsedCustom: Record<string, string> = {};
                    if (l.customFields) { try { parsedCustom = JSON.parse(l.customFields); } catch {} }
                    return (
                      <tr key={l.id}>
                        <td className="text-muted text-xs">{i + 1}</td>
                        <td>
                          <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="w-4 h-4" />
                        </td>
                        <td className="font-medium">{l.email}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-ink ${provider.colors}`}>
                            {provider.logo ? (
                              <img src={provider.logo} alt="" className="w-3.5 h-3.5 rounded-full object-contain" />
                            ) : (
                              <span className="text-[10px] leading-none">{provider.glyph}</span>
                            )}
                            {provider.name}
                          </span>
                        </td>
                        {columns.customKeys.length > 0 ? (
                          columns.customKeys.map(k => <td key={k} className="text-muted">{parsedCustom[k] || ""}</td>)
                        ) : (
                          <>
                            {columns.firstName && <td>{l.firstName}</td>}
                            {columns.lastName && <td>{l.lastName}</td>}
                            {columns.company && <td className="text-muted">{l.company}</td>}
                            {columns.title && <td className="text-muted">{l.title}</td>}
                            {columns.phone && <td className="text-muted">{l.phone}</td>}
                            {columns.website && <td className="text-muted">{l.website}</td>}
                            {columns.location && <td className="text-muted">{l.location}</td>}
                            {columns.notes && <td className="text-muted">{l.notes}</td>}
                          </>
                        )}
                        <td><span className={`badge ${l.status === "replied" ? "active" : l.status === "pending" ? "draft" : ""}`}>{l.status}</span></td>
                        <td>
                          <VerificationStatusBadge status={l.verificationStatus} verifying={verifyingIds.has(l.id)} />
                        </td>
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
              <button onClick={() => setShowImport(false)} className="text-muted hover:text-blue-accent transition-colors flex items-center justify-center">
                <Cancel01Icon size={20} />
              </button>
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
                <div className={`text-sm p-3 rounded-lg mb-4 whitespace-pre-line ${importResult.error || importResult.firstError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {importResult.error || (importResult.firstError
                    ? `${importResult.imported} imported, ${importResult.errors} errors (e.g. ${importResult.firstError})`
                    : `${importResult.imported} imported, ${importResult.errors || 0} errors, ${importResult.skipped || 0} skipped (no email) out of ${importResult.total}${importResult.duplicates ? `, ${importResult.duplicates} duplicates skipped` : ""}`)}
                  {importResult.duplicateEmails && importResult.duplicateEmails.length > 0 && (
                    <div className="mt-2 text-xs opacity-70">
                      Duplicates: {importResult.duplicateEmails.join(", ")}
                    </div>
                  )}
                </div>
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
                        <Upload01Icon size={32} className="mx-auto mb-3 text-muted-2" />
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
      <ConfirmModal
        open={!!confirmDelete}
        title="Delete lead?"
        message="This lead will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && doRemove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        variant="danger"
      />
      <ConfirmModal
        open={showConfirmSelected}
        title={`Delete ${selectedIds.size} lead${selectedIds.size > 1 ? "s" : ""}?`}
        message="These leads will be permanently removed."
        confirmLabel="Delete"
        onConfirm={doRemoveSelected}
        onCancel={() => setShowConfirmSelected(false)}
        variant="danger"
      />
    </>
  );
}
