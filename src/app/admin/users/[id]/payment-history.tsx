"use client";

import { useState } from "react";

export interface PaymentRow {
  id: string;
  type: string;
  amount: number | null;
  currency: string;
  plan: string | null;
  when: string;
}

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["subs", "Subscriptions"],
  ["credits", "Credit payments"],
];

function matches(type: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "subs") return type.startsWith("subscription");
  return type === "payment_succeeded";
}

export default function PaymentHistoryTable({ payments }: { payments: PaymentRow[] }) {
  const [filter, setFilter] = useState("all");
  const shown = payments.filter((p) => matches(p.type, filter));

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {FILTERS.map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val)}
            className={`btn btn-xs ${filter === val ? "btn-primary" : "btn-ghost"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Amount</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={3} className="text-muted">No payments recorded yet — history starts accumulating once billing is enabled</td></tr>
            )}
            {shown.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.type.replaceAll("_", " ")}{p.plan ? ` · ${p.plan}` : ""}</td>
                <td className="text-muted">{p.amount != null ? `${p.currency} ${p.amount.toLocaleString()}` : "—"}</td>
                <td className="text-muted">{p.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
