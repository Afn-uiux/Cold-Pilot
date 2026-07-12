"use client";

import { useState, useEffect } from "react";

type Campaign = { id: string; name: string };
type EmailAccount = { id: string; email: string };
type Thread = {
  id: string; name: string; email: string;
  campaignId: string | null; campaignName: string | null;
  emailAccountId: string | null; emailAccountEmail: string | null;
  subject: string; preview: string; time: string;
  unread: boolean; repliedAt: string | null;
  dealStage: string | null; dealStatus: string | null; dealValue: number;
  source: "campaign" | "inbox";
};
type EmailLogEntry = {
  id: string; subject: string | null; bodyHtml: string | null;
  sentAt: string; type: string; status: string;
  emailAccount: { email: string } | null; repliedAt: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", interested: "Interested", meeting_booked: "Meeting booked", meeting_completed: "Meeting completed",
  won: "Won", no_show: "No Show", out_of_office: "Out of office", wrong_person: "Wrong person",
  not_interested: "Not interested", lost: "Lost",
};
const POSITIVE_STAGES = ["lead", "interested", "meeting_booked", "meeting_completed", "won"];
const NEGATIVE_STAGES = ["no_show", "out_of_office", "wrong_person", "not_interested", "lost"];
const ALL_STAGES = [...POSITIVE_STAGES, ...NEGATIVE_STAGES];

function stageBadgeClass(s: string) {
  return POSITIVE_STAGES.includes(s) ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700";
}

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lead, setLead] = useState<any>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [reply, setReply] = useState("");
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<string | null>(null);
  const [moreFilter, setMoreFilter] = useState<string>("inbox");

  const [coldboxOpen, setColdboxOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);
  const [statusMoreOpen, setStatusMoreOpen] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const [inboxesOpen, setInboxesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [statusSearch, setStatusSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [inboxSearch, setInboxSearch] = useState("");
  const [moreSearch, setMoreSearch] = useState("");

  useEffect(() => {
    fetch("/api/inbox").then(r => r.json()).then(data => {
      if (data.threads) setThreads(data.threads);
      if (data.campaigns) setCampaigns(data.campaigns);
      if (data.emailAccounts) setEmailAccounts(data.emailAccounts);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  function selectThread(id: string) {
    setSelectedId(id);
    setThreadLoading(true);
    setReply("");
    setSentOk(false);
    fetch(`/api/inbox?id=${id}`).then(r => r.json()).then(data => {
      if (data.lead) setLead(data.lead);
      if (Array.isArray(data.emailLogs)) setEmailLogs(data.emailLogs);
    }).catch(() => {}).finally(() => setThreadLoading(false));
    fetch("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id }),
    }).then(() => {
      setThreads(prev => prev.map(t => t.id === id ? { ...t, unread: false } : t));
    }).catch(() => {});
  }

  async function deleteThread() {
    if (!selectedId) return;
    if (!confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`/api/inbox?leadId=${selectedId}`, { method: "DELETE" });
      if (res.ok) {
        setThreads(prev => prev.filter(t => t.id !== selectedId));
        setSelectedId(null);
        setLead(null);
        setEmailLogs([]);
      }
    } catch {}
  }

  async function sendReply() {
    if (!reply.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedId, body: reply }),
      });
      if (res.ok) {
        setReply("");
        setSentOk(true);
        // Refresh thread
        selectThread(selectedId);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to send");
      }
    } catch {
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  const selectedThread = threads.find(t => t.id === selectedId);

  // Filter threads
  let filtered = threads.filter(t => t.unread || t.dealStage);
  if (statusFilter) filtered = filtered.filter(t => t.dealStage === statusFilter);
  if (campaignFilter) filtered = filtered.filter(t => t.campaignId === campaignFilter);
  if (inboxFilter) filtered = filtered.filter(t => t.emailAccountId === inboxFilter);
  if (moreFilter === "unread") filtered = filtered.filter(t => t.unread);
  if (moreFilter === "sent") filtered = filtered;

  function Dropdown({ open, onToggle, label, children }: { open: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
    return (
      <div className="border-b border-border">
        <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted hover:text-blue-accent transition-colors">
          <span>{label}</span>
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {open && <div className="pb-2">{children}</div>}
      </div>
    );
  }

  function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
      <div className="px-3 pb-1.5">
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "Search..."}
          className="w-full bg-cream border border-border rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-blue-accent placeholder:text-muted-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Coldbox top bar — always visible */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-cream-2/30 shrink-0">
        <h2 className="text-base font-medium">Coldbox</h2>
        <button onClick={() => setColdboxOpen(!coldboxOpen)}
          className="text-muted hover:text-blue-accent transition-colors p-0.5">
          <svg className={`w-4 h-4 transition-transform duration-200 ${coldboxOpen ? "rotate-180" : "-rotate-90"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar filters */}
      <div className={`${coldboxOpen ? "w-[260px]" : "w-0"} shrink-0 border-r border-border overflow-hidden bg-cream-2/30 transition-all duration-200 ease-in-out`}>
        <div className="w-[260px] overflow-y-auto">
          {/* Status dropdown */}
          <Dropdown open={statusOpen} onToggle={() => setStatusOpen(!statusOpen)} label="Status">
            <SearchBar value={statusSearch} onChange={setStatusSearch} placeholder="Search status..." />
            <div className="space-y-0.5 px-1">
              {ALL_STAGES.filter(s => !statusSearch || s.includes(statusSearch.toLowerCase()) || (STAGE_LABELS[s] || "").toLowerCase().includes(statusSearch.toLowerCase())).map(s => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors flex items-center justify-between ${statusFilter === s ? "bg-blue-accent text-white" : "text-muted hover:bg-cream"}`}>
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${POSITIVE_STAGES.includes(s) ? "bg-purple-500" : "bg-red-400"}`} />
                    {STAGE_LABELS[s] || s}
                  </span>
                  <span className="text-[10px] opacity-60">{threads.filter(t => t.dealStage === s).length}</span>
                </button>
              ))}
            </div>
            <div className="mt-1 border-t border-border pt-1 mx-3">
              <button onClick={() => setStatusMoreOpen(!statusMoreOpen)}
                className="w-full text-left text-xs px-3 py-1.5 rounded-md text-muted hover:bg-cream flex items-center justify-between">
                <span>More</span>
                <svg className={`w-2.5 h-2.5 transition-transform ${statusMoreOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {statusMoreOpen && (
                <div className="space-y-0.5 pl-3">
                  {NEGATIVE_STAGES.filter(s => !statusSearch || s.includes(statusSearch.toLowerCase()) || (STAGE_LABELS[s] || "").toLowerCase().includes(statusSearch.toLowerCase())).map(s => (
                    <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                      className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors flex items-center justify-between ${statusFilter === s ? "bg-blue-accent text-white" : "text-muted hover:bg-cream"}`}>
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full bg-red-400`} />
                        {STAGE_LABELS[s]}
                      </span>
                      <span className="text-[10px] opacity-60">{threads.filter(t => t.dealStage === s).length}</span>
                    </button>
                  ))}

                </div>
              )}
            </div>
          </Dropdown>

          {/* All Campaigns dropdown */}
          <Dropdown open={campaignsOpen} onToggle={() => setCampaignsOpen(!campaignsOpen)} label="All Campaigns">
            <SearchBar value={campaignSearch} onChange={setCampaignSearch} placeholder="Search campaigns..." />
            <div className="space-y-0.5 px-1">
              {campaigns.filter(c => !campaignSearch || c.name.toLowerCase().includes(campaignSearch.toLowerCase())).map(c => (
                <button key={c.id} onClick={() => setCampaignFilter(campaignFilter === c.id ? null : c.id)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors flex items-center justify-between ${campaignFilter === c.id ? "bg-blue-accent text-white" : "text-muted hover:bg-cream"}`}>
                  <span>{c.name}</span>
                  <span className="text-[10px] opacity-60">{threads.filter(t => t.campaignId === c.id).length}</span>
                </button>
              ))}
            </div>
          </Dropdown>

          {/* All Inboxes dropdown */}
          <Dropdown open={inboxesOpen} onToggle={() => setInboxesOpen(!inboxesOpen)} label="All Inboxes">
            <SearchBar value={inboxSearch} onChange={setInboxSearch} placeholder="Search inboxes..." />
            <div className="space-y-0.5 px-1">
              {emailAccounts.filter(a => !inboxSearch || a.email.toLowerCase().includes(inboxSearch.toLowerCase())).map(a => (
                <button key={a.id} onClick={() => setInboxFilter(inboxFilter === a.id ? null : a.id)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors ${inboxFilter === a.id ? "bg-blue-accent text-white" : "text-muted hover:bg-cream"}`}>
                  {a.email}
                </button>
              ))}
            </div>
          </Dropdown>

          {/* More dropdown */}
          <Dropdown open={moreOpen} onToggle={() => setMoreOpen(!moreOpen)} label="More">
            <SearchBar value={moreSearch} onChange={setMoreSearch} placeholder="Search views..." />
            <div className="space-y-0.5 px-1">
              {[
                { key: "inbox", label: "Inbox" },
                { key: "unread", label: "Unread only" },
                { key: "sent", label: "Sent" },
              ].filter(item => !moreSearch || item.label.toLowerCase().includes(moreSearch.toLowerCase())).map(item => (
                <button key={item.key} onClick={() => setMoreFilter(item.key)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors ${moreFilter === item.key ? "bg-blue-accent text-white" : "text-muted hover:bg-cream"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </Dropdown>
        </div>
        </div>

      {/* Thread list */}
      <div className="w-[360px] shrink-0 border-r border-border overflow-y-auto">
        <div className="border-b border-border">
          <div className="text-xs font-medium py-3 text-center text-ink relative">
            Primary
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-accent rounded-full" />
          </div>
        </div>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-[11px] text-muted">
            Campaign replies & lead activity
            {statusFilter && <span> / {STAGE_LABELS[statusFilter] || statusFilter}</span>}
            {moreFilter !== "inbox" && <span> / {moreFilter}</span>}
            <span className="ml-1">— {filtered.length}</span>
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-muted text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted text-center">
            "No conversations"
          </div>
        ) : filtered.map(t => (
          <div key={t.id}
            onClick={() => selectThread(t.id)}
            className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-5 py-3.5 border-b border-border cursor-pointer transition-colors hover:bg-cream-2 ${selectedId === t.id ? "bg-cream-2" : ""}`}
            style={t.unread ? { fontWeight: 600 } : {}}
          >
            <div className="flex items-center gap-2 text-sm overflow-hidden text-ellipsis whitespace-nowrap col-span-2">
              {t.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-accent shrink-0" />}
              {t.name}
              {t.dealStage && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${stageBadgeClass(t.dealStage)}`}>
                  {STAGE_LABELS[t.dealStage] || t.dealStage}
                </span>
              )}
            </div>
            <div className="text-xs text-ink overflow-hidden text-ellipsis whitespace-nowrap">{t.subject}</div>
            <span className="text-[11px] text-muted-2 whitespace-nowrap">{t.time}</span>
            {t.preview && <div className="text-[11px] text-muted overflow-hidden text-ellipsis whitespace-nowrap col-span-2">{t.preview}</div>}
            {t.campaignName && <div className="text-[10px] text-muted-2 col-span-2">via {t.campaignName}</div>}
          </div>
        ))}
      </div>

      {/* Thread view */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {threadLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading thread...</div>
        ) : selectedThread && lead ? (
          <>
            <div className="px-8 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-lg">{selectedThread.subject}</h3>
                {selectedThread.dealStage && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageBadgeClass(selectedThread.dealStage)}`}>
                    {STAGE_LABELS[selectedThread.dealStage] || selectedThread.dealStage}
                  </span>
                )}
                <button onClick={deleteThread}
                  className="ml-auto text-muted hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50"
                  title="Delete conversation">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-muted mt-1">{selectedThread.name} &lt;{selectedThread.email}&gt;</p>
              {selectedThread.emailAccountEmail && <p className="text-xs text-muted-2 mt-0.5">via {selectedThread.emailAccountEmail}</p>}
              {lead?.campaign && <p className="text-xs text-muted-2 mt-0.5">Campaign: {lead.campaign.name}</p>}
            </div>
            <div className="flex-1 px-8 py-6 overflow-y-auto">
              {emailLogs.length > 0 ? emailLogs.map((log, i) => {
                const bodyText = log.bodyHtml ? log.bodyHtml.replace(/<[^>]*>/g, "").trim() : "(no content)";
                return (
                  <div key={log.id} className="max-w-[600px] mb-6">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-7 h-7 rounded-full bg-cream-2 border border-border flex items-center justify-center text-[11px] font-medium text-muted shrink-0">
                        {log.type === "outgoing" ? "Y" : selectedThread.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{log.type === "outgoing" ? "You" : selectedThread.name}</span>
                      <span className="text-xs text-muted-2 ml-auto">{formatDate(log.sentAt)}</span>
                    </div>
                    <div className="text-sm text-muted leading-relaxed pl-10">
                      {log.subject && <p className="text-xs text-muted-2 mb-1">{log.subject}</p>}
                      <p>{bodyText.slice(0, 500)}</p>
                    </div>
                    {log.repliedAt && (
                      <div className="mt-2 border-l-2 border-blue-accent pl-4">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className="text-sm font-medium text-blue-accent">Reply from {selectedThread.name}</span>
                          <span className="text-xs text-muted-2">{formatDate(log.repliedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="text-sm text-muted py-8 text-center">No messages yet</div>
              )}
            </div>
            <div className="px-8 py-5 border-t border-border">
              {sentOk && <p className="text-xs text-green-600 mb-2">Reply sent!</p>}
              <textarea value={reply} onChange={e => setReply(e.target.value)}
                placeholder="Write your reply..."
                className="w-full bg-transparent border-none outline-none resize-none text-sm min-h-[60px] leading-relaxed"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-border mt-3">
                <button onClick={() => setReply("")} className="text-xs text-muted hover:text-blue-accent px-3 py-1.5">Clear</button>
                <button onClick={sendReply} disabled={!reply.trim() || sending}
                  className="btn btn-primary btn-sm">
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-2 gap-3 flex-col">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Select a conversation
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
