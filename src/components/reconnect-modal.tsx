"use client";

import { useEffect, useState } from "react";
import { Cancel01Icon } from "@/components/icons/cancel-01";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { CircleXIcon } from "@/components/icons/circle-x";

type AccountLike = {
  id: string;
  email: string;
  provider?: string | null;
  smtpUser?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  imapHost?: string | null;
  imapPort?: number | null;
  imapUser?: string | null;
};

export default function ReconnectModal({
  account,
  onClose,
  onReconnected,
}: {
  account: AccountLike;
  onClose: () => void;
  onReconnected: () => void;
}) {
  const [pass, setPass] = useState("");
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isOAuth = !account.smtpUser;
  const isGoogleOAuth = isOAuth && (account.provider === "Gmail" || account.provider === "gmail");

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.data?.success !== undefined && e.data?.source) {
        setConnecting(false);
        if (e.data.success) {
          setMsg({ type: "success", text: "Reconnected!" });
          setTimeout(() => { onReconnected(); onClose(); }, 900);
        } else {
          setMsg({ type: "error", text: e.data.error || "Reconnect failed. Try again." });
        }
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onClose, onReconnected]);

  function openMicrosoftOAuth() {
    const width = 600, height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    setMsg(null);
    setConnecting(true);
    window.open("/api/email-accounts/microsoft/auth", "microsoft-oauth", `width=${width},height=${height},left=${left},top=${top}`);
  }

  function openGoogleOAuth() {
    const width = 600, height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    setMsg(null);
    setConnecting(true);
    window.open("/api/email-accounts/google/auth", "google-oauth", `width=${width},height=${height},left=${left},top=${top}`);
  }

  async function submit() {
    if (!pass.trim()) {
      setMsg({ type: "error", text: "Enter your new password or app password." });
      return;
    }
    setTesting(true);
    setMsg(null);
    const payload: Record<string, any> = {};
    if (account.smtpHost) {
      payload.smtpHost = account.smtpHost;
      payload.smtpPort = account.smtpPort || 587;
      payload.smtpUser = account.smtpUser;
      payload.smtpPass = pass.trim();
    }
    if (account.imapHost) {
      payload.imapHost = account.imapHost;
      payload.imapPort = account.imapPort || 993;
      payload.imapUser = account.imapUser || account.smtpUser;
      payload.imapPass = pass.trim();
    }
    try {
      const res = await fetch("/api/email-accounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setTesting(false);
        setMsg({ type: "error", text: data.error || "Those credentials were rejected. Double-check the password and try again." });
        return;
      }
      const patch = await fetch(`/api/email-accounts?id=${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpPass: pass.trim(), imapPass: pass.trim(), status: "active" }),
      });
      if (!patch.ok) {
        const e = await patch.json().catch(() => ({}));
        setTesting(false);
        setMsg({ type: "error", text: e.error || "Failed to save the new password. Try again." });
        return;
      }
      setTesting(false);
      setMsg({ type: "success", text: "Reconnected!" });
      setTimeout(() => { onReconnected(); onClose(); }, 900);
    } catch {
      setTesting(false);
      setMsg({ type: "error", text: "Network error. Try again." });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="bg-white border border-border rounded-lg w-full max-w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-1">
          <h3 className="text-base font-medium">Reconnect account</h3>
          <button onClick={onClose} className="text-muted hover:text-blue-accent transition-colors">
            <Cancel01Icon size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">
          <p className="text-sm text-muted mb-4 break-all">{account.email}</p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-4">
            This account stopped sending and reply detection is paused. Reconnect with the new password and it will resume automatically.
          </div>
          {isGoogleOAuth ? (
            <>
              <p className="text-sm text-muted mb-4">This account was connected with Google. Reconnect by signing in again.</p>
              <button onClick={openGoogleOAuth} disabled={connecting} className="btn btn-primary w-full flex items-center justify-center gap-2">
                {connecting ? "Opening Google login..." : <><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Sign in with Google</>}
              </button>
            </>
          ) : isOAuth ? (
            <>
              <p className="text-sm text-muted mb-4">This account was connected with Microsoft. Reconnect by signing in again.</p>
              <button onClick={openMicrosoftOAuth} disabled={connecting} className="btn btn-primary w-full">
                {connecting ? "Opening Microsoft login..." : "Sign in with Microsoft"}
              </button>
            </>
          ) : (
            <>
              <label className="block text-xs text-muted mb-2">New password or app password</label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); }}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent"
                placeholder="••••••••"
                autoFocus
              />
              {account.provider === "Gmail" && (
                <p className="text-xs text-muted-2 mt-2">
                  Use the Google App Password for this Gmail account.{" "}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-accent hover:underline">Get one</a>
                </p>
              )}
              {account.provider === "Yahoo" && (
                <p className="text-xs text-muted-2 mt-2">Yahoo requires an app-specific password. Make sure IMAP access is enabled.</p>
              )}
              <button onClick={submit} disabled={testing} className="btn btn-primary w-full mt-5">
                {testing ? "Testing connection..." : "Reconnect"}
              </button>
            </>
          )}
          {msg && (
            <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {msg.type === "success" ? (
                <CircleCheckIcon size={16} />
              ) : (
                <CircleXIcon size={16} />
              )}
              <span>{msg.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
