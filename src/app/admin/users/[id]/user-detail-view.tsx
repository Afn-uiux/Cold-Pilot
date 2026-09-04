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
  displayName: string;
  email: string;
  plan: string;
  role: string;
  deleted: boolean;
  metrics: UserMetric[];
  payments: PaymentRow[];
  transactions: { id: string; amount: string; reason: string; when: string }[];
  campaigns: { id: string; name: string; status: string; leads: string; updated: string }[];
  accounts: { id: string; email: string; provider: string; health: string; flags: string }[];
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
  const slug = data.email.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return (
    <div>
      <div className="flex gap-1.5 mt-6">
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
                  data.accounts.map((a) => ({ email: a.email, provider: a.provider, health: a.health, flags: a.flags }))
                )
              }
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Health</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">No connected accounts</td></tr>
                  )}
                  {data.accounts.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.email}<span className="text-muted font-normal"> · {a.provider}</span></td>
                      <td className="text-muted">{a.health}</td>
                      <td className="text-muted">{a.flags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
