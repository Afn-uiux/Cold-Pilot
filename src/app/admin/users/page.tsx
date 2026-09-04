"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search01Icon } from "@/components/icons/search-01";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  deletedAt: string | null;
  riskScore: number;
  riskFlags: string;
  riskStatus: string;
  trialVoided: boolean;
  trialVoidReason: string | null;
  signupIp: string | null;
  reviewedAt: string | null;
  plan: string;
  creditBalance: number;
  trialEndsAt: string | null;
  bachsSubscriptionId: string | null;
  _count: { campaigns: number; leads: number; emailAccounts: number };
}

const TABS: [string, string][] = [
  ["all", "All"],
  ["active", "Active"],
  ["deleted", "Deleted"],
  ["flagged", "Flagged"],
];

const FLAG_LABELS: Record<string, string> = {
  blocked_device: "Blocked device",
  blocked_ip: "Blocked IP",
  void_plus_repeat: "Void + repeat account",
  tied_mailbox_signup: "Tied mailbox signup",
  device_repeat: "Repeated device",
  ip_repeat: "Repeated IP",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchUsers(q: string, t: string, p: string = planFilter) {
    setLoading(true);
    const isFlagged = t === "flagged";
    const status = isFlagged ? "active" : t;
    const flag = isFlagged ? "flagged" : "all";
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&status=${status}&flag=${flag}&plan=${p}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/users?search=&status=all&flag=all");
      const data = await res.json();
      if (active) {
        setUsers(data.users || []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(search, tab, planFilter);
  }

  function changeTab(t: string) {
    setTab(t);
    fetchUsers(search, t, planFilter);
  }

  function changePlan(p: string) {
    setPlanFilter(p);
    fetchUsers(search, tab, p);
  }

  async function patchUser(userId: string, body: Record<string, unknown>) {
    setActionLoading(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActionLoading(null);
    fetchUsers(search, tab);
  }

  function killUser(u: AdminUser) {
    const ok = window.confirm(
      `Kill ${u.email}?\n\nPauses all activity, voids the trial permanently, and blocks this device/IP from future signups.`
    );
    if (ok) patchUser(u.id, { kill: true });
  }

  const flaggedCount = users.filter(u => u.riskStatus === "flagged" || u.riskStatus === "banned" || u.trialVoided).length;

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
            Users
          </h1>
          <p className="text-sm text-muted mt-1.5">{users.length} users</p>
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <form onSubmit={handleSearch} className="toolbar">
          <div className="toolbar-left">
            <div className="search">
              <Search01Icon size={14} className="pointer-events-none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7A9AB5" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
              />
            </div>
            <div className="flex gap-1.5 ml-2">
              {TABS.map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => changeTab(val)}
                  className={`btn btn-xs ${tab === val ? "btn-primary" : "btn-ghost"}`}
                >
                  {label}
                  {val === "flagged" && flaggedCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold">
                      {flaggedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <select
              value={planFilter}
              onChange={(e) => changePlan(e.target.value)}
              className="btn btn-xs btn-ghost ml-2"
              aria-label="Filter by plan"
            >
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Credits</th>
                <th>Risk</th>
                <th>Campaigns</th>
                <th>Leads</th>
                <th>Accounts</th>
                <th>Joined</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center text-muted-2 py-12">Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center text-muted-2 py-12">No users found</td>
                </tr>
              ) : (
                users.map((u) => {
                  const flags = parseFlags(u.riskFlags);
                  const needsReview = u.riskStatus === "flagged" || u.riskStatus === "banned";
                  return (
                    <tr key={u.id} className={u.deletedAt ? "opacity-70" : ""}>
                      <td className="font-medium">
                        <Link href={`/admin/users/${u.id}`} className="hover:text-blue-accent transition-colors">
                          {u.name || "—"}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/admin/users/${u.id}`} className="hover:text-blue-accent transition-colors">
                          {u.email}
                        </Link>
                      </td>
                      <td>
                        {(u.plan ?? "free") !== "free" ? (
                          <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {u.plan}{u.bachsSubscriptionId ? " · sub" : ""}
                          </span>
                        ) : (
                          <span className="badge draft">free</span>
                        )}
                      </td>
                      <td className="text-muted">{Math.round(u.creditBalance ?? 0)}</td>
                      <td>
                        {needsReview || u.trialVoided ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`badge ${u.riskStatus === "banned" ? "" : "active"} ${u.riskStatus === "banned" ? "bg-red-50 text-red-700 border border-red-200" : ""}`}>
                              {u.riskStatus === "banned" ? "Banned" : u.riskStatus === "flagged" ? `Flagged · ${u.riskScore}` : u.trialVoided ? "Trial voided" : "Flagged"}
                            </span>
                            {flags.map(f => (
                              <span key={f} className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {FLAG_LABELS[f] || f}
                              </span>
                            ))}
                            {u.trialVoided && (
                              <span className="text-[11px] text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {u.trialVoidReason === "mailbox_reuse" ? "Reused mailbox" : u.trialVoidReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">{u.riskScore > 0 ? `Score ${u.riskScore}` : "—"}</span>
                        )}
                      </td>
                      <td>{u._count.campaigns}</td>
                      <td>{u._count.leads}</td>
                      <td>{u._count.emailAccounts}</td>
                      <td className="text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        {u.deletedAt ? (
                          <span className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Deleted {new Date(u.deletedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Active
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {u.deletedAt ? (
                            <button
                              onClick={() => patchUser(u.id, { restore: true })}
                              disabled={actionLoading === u.id}
                              className="btn btn-ghost btn-xs"
                            >
                              {actionLoading === u.id ? "..." : "Restore"}
                            </button>
                          ) : (
                            <>
                              {needsReview && (
                                <>
                                  <button
                                    onClick={() => patchUser(u.id, { markReviewed: true })}
                                    disabled={actionLoading === u.id}
                                    className="btn btn-ghost btn-xs"
                                  >
                                    {actionLoading === u.id ? "..." : "Review"}
                                  </button>
                                  <button
                                    onClick={() => patchUser(u.id, { clearFlag: true })}
                                    disabled={actionLoading === u.id}
                                    className="btn btn-ghost btn-xs"
                                  >
                                    Clear
                                  </button>
                                  <button
                                    onClick={() => killUser(u)}
                                    disabled={actionLoading === u.id}
                                    className="btn btn-ghost btn-xs text-red-600 hover:text-red-700"
                                  >
                                    {actionLoading === u.id ? "..." : "Kill"}
                                  </button>
                                </>
                              )}
                              {!needsReview && u.riskStatus === "reviewed" && (
                                <>
                                  <button
                                    onClick={() => patchUser(u.id, { clearFlag: true })}
                                    disabled={actionLoading === u.id}
                                    className="btn btn-ghost btn-xs"
                                  >
                                    Clear
                                  </button>
                                  <button
                                    onClick={() => killUser(u)}
                                    disabled={actionLoading === u.id}
                                    className="btn btn-ghost btn-xs text-red-600 hover:text-red-700"
                                  >
                                    {actionLoading === u.id ? "..." : "Kill"}
                                  </button>
                                </>
                              )}
                              {u.riskStatus === "none" && !u.trialVoided && (
                                <button
                                  onClick={() => patchUser(u.id, { riskStatus: "flagged" })}
                                  disabled={actionLoading === u.id}
                                  className="btn btn-ghost btn-xs"
                                >
                                  {actionLoading === u.id ? "..." : "Flag"}
                                </button>
                              )}
                              <button
                                onClick={() => patchUser(u.id, { role: u.role === "admin" ? "user" : "admin" })}
                                disabled={actionLoading === u.id}
                                className="btn btn-ghost btn-xs"
                              >
                                {actionLoading === u.id ? "..." : u.role === "admin" ? "Remove Admin" : "Make Admin"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function parseFlags(raw: string): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
