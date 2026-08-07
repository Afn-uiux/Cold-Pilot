"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import ApiKeysSection from "@/components/api-keys-section";
import WebhooksSection from "@/components/webhooks-section";
import IntegrationsSection from "@/components/integrations-section";
import BillingSection from "@/components/billing-section";

const TABS = ["Profile", "Team", "Billing", "Integrations", "API Keys"];

export default function SettingsTabs({ user }: { user: { name: string | null; email: string | null; image: string | null; createdAt: Date } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "Profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function deleteAccount() {
    if (deleteConfirm !== user.email) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Failed to delete account. Please try again.");
        setDeleting(false);
        return;
      }
      await signOut({ redirect: false });
      router.push("/");
    } catch {
      setDeleteError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
        }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  async function inviteMember() {
    if (!inviteEmail.includes("@")) return;
    setInviting(true);
    try {
      await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      setInviteEmail("");
    } catch {}
    setInviting(false);
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Settings</h1>
          <p className="text-sm text-muted mt-1.5">Manage your account and preferences</p>
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="grid grid-cols-[200px_1fr] gap-10 items-start">
          <div className="flex flex-col gap-0.5 sticky top-8">
            {TABS.map((item) => (
              <button key={item} onClick={() => setActiveTab(item)}
                className={`text-sm text-left px-4 py-2.5 rounded transition-colors ${activeTab === item ? "bg-cream-2 text-ink font-medium" : "text-muted hover:text-ink"}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {activeTab === "Profile" && (
              <form onSubmit={saveProfile} className="card">
                <div className="card-header"><h3>Profile</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="field-group">
                    <label className="block text-xs text-muted mb-2">Name</label>
                    <input name="name" className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-ink transition-colors" defaultValue={user.name || ""} />
                  </div>
                  <div className="field-group">
                    <label className="block text-xs text-muted mb-2">Email</label>
                    <input name="email" suppressHydrationWarning className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-ink transition-colors" defaultValue={user.email || ""} />
                  </div>
                </div>
                {saved && <p className="text-xs text-green-600 mt-2">Saved!</p>}
                <div className="mt-6"><button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? "Saving..." : "Save Changes"}</button></div>
              </form>
            )}

            {activeTab === "Profile" && (
              <div className="card border border-red-200">
                <div className="card-header"><h3>Danger zone</h3></div>
                <p className="text-sm text-muted mb-4">Permanently deletes your account and signs you out. Campaigns pause immediately and all data is removed from your access. This cannot be undone.</p>
                <button onClick={() => { setDeleteConfirm(""); setDeleteError(""); setShowDelete(true); }} className="btn btn-sm bg-red-600 hover:bg-red-700 text-white">Delete account</button>
              </div>
            )}

            {activeTab === "Team" && (
              <div className="card">
                <div className="card-header"><h3>Team</h3></div>
                <div className="flex items-center justify-between p-4 bg-cream-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-xs font-medium">
                      {(user.name || user.email || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.name || "User"}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                  </div>
                  <span className="badge active">Owner</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="Email to invite"
                    className="flex-1 bg-transparent border-b border-border pb-2 text-sm outline-none focus:border-ink transition-colors" />
                  <button onClick={inviteMember} disabled={inviting || !inviteEmail.includes("@")}
                    className="btn btn-ghost btn-sm shrink-0">
                    {inviting ? "Inviting..." : "+ Invite"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "Billing" && (
              <BillingSection />
            )}

            {activeTab === "Integrations" && (
              <>
                <div className="card">
                  <div className="card-header"><h3>Integrations</h3></div>
                  <IntegrationsSection />
                </div>
                <div className="card">
                  <div className="card-header"><h3>Webhooks</h3></div>
                  <WebhooksSection />
                </div>
              </>
            )}

            {activeTab === "API Keys" && (
              <div className="card">
                <div className="card-header"><h3>API Keys</h3></div>
                <ApiKeysSection />
              </div>
            )}
          </div>
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowDelete(false)}>
          <div className="bg-cream border border-border rounded-lg w-[90%] max-w-[420px] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-2">Delete account?</h3>
            <p className="text-sm text-muted mb-4 leading-relaxed">This permanently deletes your account and all your data. It cannot be undone. Type <span className="font-medium text-ink">{user.email}</span> to confirm.</p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={user.email || ""}
              className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-ink transition-colors"
            />
            {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowDelete(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                onClick={deleteAccount}
                disabled={deleting || deleteConfirm !== user.email}
                className="btn btn-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
