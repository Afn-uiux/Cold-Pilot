"use client";

import { useState, useEffect } from "react";

interface Group {
  id: string;
  name: string;
  _count: { leads: number };
  createdAt: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/groups");
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  }

  async function createGroup() {
    if (!name.trim()) return;
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setShowCreate(false);
    load();
  }

  async function deleteGroup(id: string) {
    await fetch(`/api/groups?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Contact Groups</h1>
          <p className="text-sm text-muted mt-0.5">Organize leads into groups for easy management</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          New Group
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-2 text-sm">No groups yet</p>
          <p className="text-muted text-xs mt-1">Create a group to organize your leads</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="bg-cream border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">{g.name}</h3>
                <button onClick={() => deleteGroup(g.id)} className="text-muted hover:text-red-500 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-muted">{g._count.leads} lead{g._count.leads !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">Create Group</h2>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Group name"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-accent"
              onKeyDown={e => e.key === "Enter" && createGroup()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-muted hover:text-blue-accent transition-colors">Cancel</button>
              <button onClick={createGroup} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
