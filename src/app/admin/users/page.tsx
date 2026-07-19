"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: { campaigns: number; leads: number; emailAccounts: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchUsers(q: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers("");
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(search);
  }

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setActionLoading(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    fetchUsers(search);
  }

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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
              />
            </div>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Campaigns</th>
                <th>Leads</th>
                <th>Accounts</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-2 py-12">Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-2 py-12">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name || "—"}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === "admin" ? "active" : "draft"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u._count.campaigns}</td>
                    <td>{u._count.leads}</td>
                    <td>{u._count.emailAccounts}</td>
                    <td className="text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => toggleRole(u.id, u.role)}
                        disabled={actionLoading === u.id}
                        className="btn btn-ghost btn-xs"
                      >
                        {actionLoading === u.id ? "..." : u.role === "admin" ? "Remove Admin" : "Make Admin"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
