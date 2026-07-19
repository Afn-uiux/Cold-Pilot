"use client";

import { useEffect, useState } from "react";

interface Backup {
  name: string;
  size: string;
  created: string;
}

export default function BackupSection() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchBackups() {
    const res = await fetch("/api/admin/backup");
    const data = await res.json();
    setBackups(data.backups || []);
    setLoading(false);
  }

  useEffect(() => { fetchBackups(); }, []);

  async function createBackup() {
    setCreating(true);
    setMsg(null);
    const res = await fetch("/api/admin/backup", { method: "POST" });
    const data = await res.json();
    setCreating(false);
    if (data.success) {
      setMsg(`Backup created: ${data.file} (${data.size})`);
      fetchBackups();
    } else {
      setMsg(data.error || "Backup failed");
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-[clamp(20px,2.5vw,24px)] tracking-tight">Backups</h2>
        <button onClick={createBackup} disabled={creating} className="btn btn-primary btn-sm">
          {creating ? "Creating..." : "+ Backup Now"}
        </button>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded-lg mb-4 whitespace-pre-line ${
          msg.includes("created") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {msg}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center text-muted-2 py-8">Loading...</td></tr>
            ) : backups.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted-2 py-8">No backups yet</td></tr>
            ) : (
              backups.map((b) => (
                <tr key={b.name}>
                  <td className="font-medium">{b.name}</td>
                  <td>{b.size}</td>
                  <td className="text-muted">{new Date(b.created).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
