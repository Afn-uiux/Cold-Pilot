"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import ConfirmModal from "@/components/confirm-modal";
import ReconnectModal from "@/components/reconnect-modal";
import AccountsConnector from "@/components/accounts-connector";

type Account = { id: string; email: string; provider: string; sent: number; dailySendLimit: number; warmupEnabled: boolean; warmupSent?: number; health?: number; healthScore?: number; status: string; smtpUser?: string | null; smtpHost?: string | null; smtpPort?: number | null; imapHost?: string | null; imapPort?: number | null; imapUser?: string | null; };

export default function EmailAccountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [reconnectAccount, setReconnectAccount] = useState<Account | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  function refreshAccounts() {
    fetch("/api/email-accounts")
      .then(r => r.json())
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/email-accounts")
      .then(r => r.json())
      .then(data => { setAccounts(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function doRemove(id: string) {
    await fetch(`/api/email-accounts?id=${id}`, { method: "DELETE" });
    refreshAccounts();
    toast("Account removed", "success");
    setConfirmRemove(null);
  }

  async function handleWarmupToggle(id: string) {
    setToggling(prev => new Set(prev).add(id));
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, warmupEnabled: !a.warmupEnabled } : a));
    await fetch("/api/warmup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailAccountId: id, action: "toggle" }) });
    setToggling(prev => { const next = new Set(prev); next.delete(id); return next; });
    refreshAccounts();
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Email Accounts</h1>
          <p className="text-sm text-muted mt-1.5">{accounts.length} connected</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">+ Connect Account</button>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <h3>No accounts connected</h3>
            <p>Connect your first email account to start sending.</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">Connect Account</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Emails Sent</th>
                  <th>Daily Limit</th>
                  <th>Warmup</th>
                  <th>Health Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/email-accounts/${encodeURIComponent(a.email)}`)}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{a.email}</span>
                        {a.status === "error" && (
                          <span className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">Needs reconnection</span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted">{a.sent ?? 0}</td>
                    <td className="text-muted">{a.dailySendLimit}</td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); handleWarmupToggle(a.id); }} disabled={toggling.has(a.id)}
                        className={`relative w-9 h-5 rounded-full transition-colors align-middle ${a.warmupEnabled ? "bg-blue-accent" : "bg-border"} ${toggling.has(a.id) ? "opacity-50" : ""}`}>
                        <span className={`absolute block w-3.5 h-3.5 bg-white rounded-full top-1/2 -translate-y-1/2 transition-all ${a.warmupEnabled ? "left-[19px]" : "left-[3px]"}`} />
                      </button>
                    </td>
                    <td className="text-muted">{a.healthScore ?? "—"}</td>
                    <td>
                      {a.status === "error" && (
                        <button onClick={e => { e.stopPropagation(); setReconnectAccount(a); }} className="text-xs text-red-600 hover:text-red-700 hover:underline mr-3">Reconnect</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setConfirmRemove(a.id); }} className="text-xs text-muted-2 hover:text-red-600 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AccountsConnector
        variant="user"
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={refreshAccounts}
      />

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove account?"
        message="This will permanently disconnect this email account. Warmup and sending will stop."
        confirmLabel="Remove"
        onConfirm={() => confirmRemove && doRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
        variant="danger"
      />

      {reconnectAccount && (
        <ReconnectModal
          account={reconnectAccount}
          onClose={() => setReconnectAccount(null)}
          onReconnected={refreshAccounts}
        />
      )}
    </div>
  );
}
