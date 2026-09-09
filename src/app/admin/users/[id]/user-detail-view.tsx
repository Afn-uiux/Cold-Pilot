"use client";

import { useState } from "react";
import { Download01Icon } from "@/components/icons/download-01";
import { downloadCsv } from "@/app/admin/_components/export-csv-button";
import StatStrip from "@/app/admin/_components/stat-strip";
import PaymentHistoryTable, { type PaymentRow } from "./payment-history";

export interface UserMetric {
  label: string;
  value: string;
  sub: string;
}

export interface UserDetailData {
  id: string;
  displayName: string;
  email: string;
  plan: string;
  role: string;
  riskStatus: string;
  trialVoided: boolean;
  deleted: boolean;
  metrics: UserMetric[];
  payments: PaymentRow[];
  transactions: { id: string; amount: string; reason: string; when: string }[];
  campaigns: { id: string; name: string; status: string; leads: string; updated: string }[];
  accounts: { id: string; email: string; provider: string; health: string; flags: string; connType: string; removed: boolean; addedAt: string; removedAt: string }[];
  bounces: { id: string; email: string; type: string; lead: string; detail: string; when: string }[];
  suppressions: { id: string; email: string; reason: string; lead: string; when: string }[];
  facts: { label: string; value: string }[];
}

const TABS: [string, string][] = [
  ["overview", "Overview"],
  ["money", "Money"],
  ["activity", "Activity"],
  ["health", "Health"],
];

function download(filename: string, rows: Record<string, string>[]) {
  downloadCsv(filename, rows);
}

function SectionHead({ title, onExport }: { title: string; onExport?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <h2 className="font-medium text-[clamp(20px,2.5vw,24px)] tracking-tight">{title}</h2>
      {onExport && (
        <button type="button" onClick={onExport} className="btn btn-ghost btn-xs flex items-center gap-1.5">
          <Download01Icon size={14} />
          CSV
        </button>
      )}
    </div>
  );
}

export default function UserDetailView({ data }: { data: UserDetailData }) {
  const [tab, setTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [riskStatus, setRiskStatus] = useState(data.riskStatus);
  const slug = data.email.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  async function patchUser(body: Record<string, unknown>) {
    setActionLoading(true);
    try {
      await fetch(`/api/admin/users/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setRiskStatus(
        typeof body.riskStatus === "string" ? body.riskStatus : body.clearFlag ? "none" : body.markReviewed ? "reviewed" : body.kill ? "banned" : riskStatus,
      );
    } finally {
      setActionLoading(false);
    }
  }

  function toggleFlag() {
    if (riskStatus === "none") patchUser({ riskStatus: "flagged" });
    else patchUser({ clearFlag: true });
  }

  function toggleRole() {
    patchUser({ role: data.role === "admin" ? "user" : "admin" });
  }

  function kill() {
    const ok = window.confirm(
      `Kill ${data.email}?\n\nPauses all activity, voids the trial permanently, and blocks this device/IP from future signups.`
    );
    if (ok) patchUser({ kill: true });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
        <div className="flex gap-1.5">
          {TABS.map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTab(val)}
              className={`btn btn-xs ${tab === val ? "btn-primary" : "btn-ghost"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={toggleFlag}
            disabled={actionLoading}
            className="btn btn-xs btn-ghost"
          >
            {actionLoading ? "..." : riskStatus === "none" ? "Flag" : "Unflag"}
          </button>
          <button
            type="button"
            onClick={toggleRole}
            disabled={actionLoading}
            className="btn btn-xs btn-ghost"
          >
            {actionLoading ? "..." : data.role === "admin" ? "Remove Admin" : "Make Admin"}
          </button>
          <button
            type="button"
            onClick={kill}
            disabled={actionLoading}
            className="btn btn-xs btn-ghost text-red-600 hover:text-red-700"
          >
            {actionLoading ? "..." : "Kill"}
          </button>
        </div>
      </div>

      {tab === "overview" && (
        <div className="mt-6">
          <StatStrip items={data.metrics.map((m) => ({ label: m.label, value: m.value, sub: m.sub }))} />

          <div className="mt-8 card">
            <SectionHead title="Account facts" />
            <div className="table-wrap">
              <table>
                <tbody>
                  {data.facts.map((f) => (
                    <tr key={f.label}>
                      <td className="font-medium">{f.label}</td>
                      <td className="text-muted">{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "money" && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="card">
            <SectionHead
              title="Payment history"
              onExport={() =>
                download(
                  `${slug}-payments.csv`,
                  data.payments.map((p) => ({
                    event: p.type.replaceAll("_", " "),
                    plan: p.plan ?? "",
                    amount: p.amount != null ? String(p.amount) : "",
                    currency: p.currency,
                    when: p.when,
                  }))
                )
              }
            />
            <PaymentHistoryTable payments={data.payments} />
          </div>

          <div className="card">
            <SectionHead
              title="Credit activity"
              onExport={() =>
                download(
                  `${slug}-credits.csv`,
                  data.transactions.map((t) => ({ amount: t.amount, reason: t.reason, when: t.when }))
                )
              }
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">No credit activity</td></tr>
                  )}
                  {data.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium">{t.amount}</td>
                      <td className="text-muted">{t.reason}</td>
                      <td className="text-muted">{t.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="card">
            <SectionHead
              title="Campaigns"
              onExport={() =>
                download(
                  `${slug}-campaigns.csv`,
                  data.campaigns.map((c) => ({ name: c.name, status: c.status, leads: c.leads, updated: c.updated }))
                )
              }
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">No campaigns</td></tr>
                  )}
                  {data.campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-muted">{c.status}</td>
                      <td>{c.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <SectionHead
              title="Sending accounts"
              onExport={() =>
                download(
                  `${slug}-accounts.csv`,
                  data.accounts.map((a) => ({ email: a.email, provider: a.provider, health: a.health, flags: a.flags, removed: a.removed ? "yes" : "no", added: a.addedAt, removed_at: a.removedAt }))
                )
              }
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Connection</th>
                    <th>Health</th>
                    <th>Flags</th>
                    <th>Added / Removed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.filter((a) => !a.removed).length === 0 && (
                    <tr><td colSpan={5} className="text-muted">No connected accounts</td></tr>
                  )}
                  {data.accounts.filter((a) => !a.removed).map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.email}<span className="text-muted font-normal"> · {a.provider}</span></td>
                      <td>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                          a.connType === "app-password" ? "text-green-700 bg-green-50 border border-green-200"
                          : a.connType === "explicit-imap" ? "text-blue-700 bg-blue-50 border border-blue-200"
                          : a.connType === "old-oauth" ? "text-amber-700 bg-amber-50 border border-amber-200"
                          : "text-red-600 bg-red-50 border border-red-200"
                        }`}>
                          {a.connType === "app-password" ? "App Password" : a.connType === "explicit-imap" ? "IMAP Creds" : a.connType === "old-oauth" ? "Old OAuth" : "No Auth"}
                        </span>
                      </td>
                      <td className="text-muted">{a.health}</td>
                      <td className="text-muted">{a.flags}</td>
                      <td className="text-muted text-xs">{a.addedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.accounts.filter((a) => a.removed).length > 0 && (
              <div className="mt-6">
                <h3 className="text-[13px] font-medium text-muted-2 uppercase tracking-wide mb-2">
                  Removed ({data.accounts.filter((a) => a.removed).length})
                </h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Connection</th>
                        <th>Added</th>
                        <th>Removed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.accounts.filter((a) => a.removed).map((a) => (
                        <tr key={a.id}>
                          <td className="font-medium text-muted line-through">{a.email}<span className="font-normal"> · {a.provider}</span></td>
                          <td>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                              a.connType === "app-password" ? "text-green-700 bg-green-50 border border-green-200"
                              : a.connType === "explicit-imap" ? "text-blue-700 bg-blue-50 border border-blue-200"
                              : a.connType === "old-oauth" ? "text-amber-700 bg-amber-50 border border-amber-200"
                              : "text-red-600 bg-red-50 border border-red-200"
                            }`}>
                              {a.connType === "app-password" ? "App Password" : a.connType === "explicit-imap" ? "IMAP Creds" : a.connType === "old-oauth" ? "Old OAuth" : "No Auth"}
                            </span>
                          </td>
                          <td className="text-muted text-xs">{a.addedAt}</td>
                          <td className="text-muted text-xs text-red-600">{a.removedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "health" && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="card">
            <SectionHead
              title="Bounces"
              onExport={() =>
                download(
                  `${slug}-bounces.csv`,
                  data.bounces.map((b) => ({ email: b.email, type: b.type, lead: b.lead, detail: b.detail, when: b.when }))
                )
              }
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Lead</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bounces.length === 0 && (
                    <tr><td colSpan={4} className="text-muted">No bounces</td></tr>
                  )}
                  {data.bounces.map((b) => (
                    <tr key={b.id}>
                      <td className="font-medium">{b.email}</td>
                      <td>{b.type}</td>
                      <td className="text-muted">{b.lead}</td>
                      <td className="text-muted">{b.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <SectionHead
              title="Suppressions"
              onExport={() =>
                download(
                  `${slug}-suppressions.csv`,
                  data.suppressions.map((s) => ({ email: s.email, reason: s.reason, lead: s.lead, when: s.when }))
                )
              }
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Reason</th>
                    <th>Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suppressions.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">Nothing suppressed</td></tr>
                  )}
                  {data.suppressions.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.email}</td>
                      <td className="text-muted">{s.reason}</td>
                      <td className="text-muted">{s.lead}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
