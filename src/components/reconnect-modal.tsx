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

  async function submit() {
    if (!pass.trim()) {
      setMsg({ type: "error", text: "Enter your new password or app password." });
      return;
    }
    setTesting(true);
    setMsg(null);

    // Google accounts now reconnect with an app password (SMTP/IMAP), matching
    // how they connect today — OAuth sign-in is no longer offered.
    const payload: Record<string, any> = isGoogleOAuth
      ? { smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: account.email, smtpPass: pass.trim(), imapHost: "imap.gmail.com", imapPort: 993, imapUser: account.email, imapPass: pass.trim() }
      : {};
    if (!isGoogleOAuth) {
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
        body: JSON.stringify({
          smtpHost: payload.smtpHost,
          smtpPort: payload.smtpPort,
          smtpUser: payload.smtpUser,
          smtpPass: payload.smtpPass,
          imapHost: payload.imapHost,
          imapPort: payload.imapPort,
          imapUser: payload.imapUser,
          imapPass: payload.imapPass,
          status: "active",
        }),
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
              <label className="block text-xs text-muted mb-2">New app password</label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); }}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-accent"
                placeholder="••••••••"
                autoFocus
              />
              <p className="text-xs text-muted-2 mt-2">
                Generate a Google App Password, then paste it here to reconnect this Gmail account.{" "}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-accent hover:underline">Get one</a>
              </p>
              <button onClick={submit} disabled={testing} className="btn btn-primary w-full mt-5">
                {testing ? "Testing connection..." : "Reconnect"}
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
