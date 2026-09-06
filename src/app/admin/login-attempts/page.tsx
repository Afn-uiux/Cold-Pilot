"use client";

import { useEffect, useState } from "react";
import { Search01Icon } from "@/components/icons/search-01";

interface LoginAttemptRow {
  id: string;
  email: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string;
  createdAt: string;
}

interface Counts {
  success: number;
  invalid: number;
  throttled: number;
  missing: number;
  error: number;
}

const REASON_LABELS: Record<string, string> = {
  success: "Success",
  invalid: "Bad credentials",
  throttled: "Rate-limited",
  missing: "Missing fields",
  error: "Error",
};

const REASON_STYLES: Record<string, { fg: string; bg: string }> = {
  success: { fg: "#2E7D32", bg: "rgba(46,125,50,0.08)" },
  invalid: { fg: "#C62828", bg: "rgba(198,40,40,0.07)" },
  throttled: { fg: "#B26A00", bg: "rgba(178,106,0,0.08)" },
  missing: { fg: "#5A6B87", bg: "rgba(90,107,135,0.08)" },
  error: { fg: "#C62828", bg: "rgba(198,40,40,0.07)" },
};

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["invalid", "Bad credentials"],
  ["throttled", "Rate-limited"],
  ["success", "Success"],
  ["error", "Error"],
];

export default function AdminLoginAttemptsPage() {
  const [rows, setRows] = useState<LoginAttemptRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    success: 0,
    invalid: 0,
    throttled: 0,
    missing: 0,
    error: 0,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function fetchRows(q: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/login-attempts?q=${encodeURIComponent(q)}&limit=200`);
    const data = await res.json();
    setRows(data.attempts || []);
    setCounts(data.counts || counts);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/login-attempts?limit=200");
      const data = await res.json();
      if (active) {
        setRows(data.attempts || []);
        setCounts(data.counts || counts);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchRows(search);
  }

  const shown = rows.filter((r) => filter === "all" || r.reason === filter);

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
            Login attempts
          </h1>
          <p className="text-sm text-muted mt-1.5">
            Everyone who tried to sign in, including failures and rate-limit hits.
          </p>
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <FilterChip label="Bad credentials" value={counts.invalid} color="#C62828" />
          <FilterChip label="Rate-limited" value={counts.throttled} color="#B26A00" />
          <FilterChip label="Errors" value={counts.error} color="#C62828" />
          <FilterChip label="Successful" value={counts.success} color="#2E7D32" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2 flex">
                <Search01Icon size={14} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, IP or reason"
                className="w-full bg-transparent border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-accent"
              />
            </div>
            <button type="submit" className="btn btn-secondary text-sm px-4 py-2">
              Search
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilter("all");
              fetchRows("");
            }}
            className="text-sm text-muted hover:text-blue-accent transition-colors"
          >
            Clear
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-2 py-10">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="text-sm text-muted-2 py-10">No login attempts match.</div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-2 border-b border-border">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Outcome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const style = REASON_STYLES[r.reason] || REASON_STYLES.error;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-b-0 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ color: style.fg, background: style.bg }}
                        >
                          {REASON_LABELS[r.reason] || r.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 break-all">{r.email}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{r.ip || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted break-all max-w-[320px]">
                        {r.userAgent || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pb-4">
          {FILTERS.map(([key, label]) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  borderColor: isActive ? "var(--color-blue-accent)" : "var(--color-border)",
                  color: isActive ? "var(--color-blue-accent)" : "var(--color-muted)",
                  background: isActive ? "rgba(37,99,235,0.06)" : "transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm"
      style={{ background: "var(--color-card)" }}
    >
      <span style={{ color }} className="font-medium tabular-nums">
        {value}
      </span>
      <span className="text-muted">{label}</span>
    </div>
  );
}