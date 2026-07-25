"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/select";
import ConfirmModal from "@/components/confirm-modal";
import { useToast } from "@/components/toast";

type Account = { id: string; email: string; provider: string; sent: number; dailySendLimit: number; warmupEnabled: boolean; warmupSent?: number; health?: number; healthScore?: number; status: string; };
type ModalScreen =
  | "select"
  | "google" | "google-app-password"
  | "microsoft"
  | "any-provider" | "any-single" | "any-imap" | "any-smtp" | "any-testing"
  | "any-bulk" | "any-bulk-review" | "any-bulk-results";

type Encryption = "none" | "ssl" | "starttls";

export default function EmailAccountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [screen, setScreen] = useState<ModalScreen>("select");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [msName, setMsName] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [msPassword, setMsPassword] = useState("");
  const [gmailName, setGmailName] = useState("");
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [imapForm, setImapForm] = useState({ username: "", password: "", host: "", port: "993" });
  const [smtpForm, setSmtpForm] = useState({ username: "", password: "", host: "", port: "587", encryption: "ssl" as Encryption });
  const [imapStatus, setImapStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [imapStatusMsg, setImapStatusMsg] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [smtpStatusMsg, setSmtpStatusMsg] = useState("");
  const [msOAuthStatus, setMsOAuthStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [msOAuthMsg, setMsOAuthMsg] = useState("");
  const [testingStatus, setTestingStatus] = useState<string[]>([]);
  const [testingError, setTestingError] = useState<string | null>(null);
  const [testingDone, setTestingDone] = useState(false);
  const [testingFrom, setTestingFrom] = useState<string>("any");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkAccounts, setBulkAccounts] = useState<any[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ total: number; success: number; failed: number; errors: { email: string; reason: string }[] } | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/email-accounts")
      .then(r => r.json())
      .then(data => { setAccounts(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openModal(initialScreen?: ModalScreen) {
    setScreen(initialScreen || "select");
    setShowModal(true);
    resetAnyForms();
  }

  function resetAnyForms() {
    setMsName(""); setMsEmail(""); setMsPassword("");
    setGmailName(""); setGmailEmail(""); setGmailPassword("");
    setSingleName(""); setSingleEmail("");
    setImapForm({ username: "", password: "", host: "", port: "993" });
    setSmtpForm({ username: "", password: "", host: "", port: "587", encryption: "ssl" });
    setMsOAuthStatus("idle"); setMsOAuthMsg("");
    setTestingStatus([]); setTestingError(null); setTestingDone(false); setTestingFrom("any");
    setImapStatus("idle"); setImapStatusMsg("");
    setSmtpStatus("idle"); setSmtpStatusMsg("");
    setBulkFile(null); setBulkAccounts([]); setBulkResults(null);
  }

  async function connectAccount(data: any) {
    try {
      const res = await fetch("/api/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to connect"); return false; }
      const account = await res.json();
      setAccounts(prev => [account, ...prev]);
      return true;
    } catch { alert("Failed to connect account"); return false; }
  }

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (event.data?.success !== undefined) {
        if (event.data.success) {
          setMsOAuthStatus("success"); setMsOAuthMsg("Microsoft account connected!");
          refreshAccounts();
          setTimeout(() => { setShowModal(false); resetAnyForms(); }, 1500);
        } else {
          setMsOAuthStatus("error"); setMsOAuthMsg(event.data.error || "Failed to connect Microsoft account.");
          setTimeout(() => setMsOAuthStatus("idle"), 4000);
        }
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function handleMicrosoftOAuth() {
    const width = 600, height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    setMsOAuthStatus("connecting"); setMsOAuthMsg("Opening Microsoft login...");
    window.open("/api/email-accounts/microsoft/auth", "microsoft-oauth", `width=${width},height=${height},left=${left},top=${top}`);
  }

  async function handleMicrosoftConnect() {
    if (!msEmail || !msPassword) { alert("Email and password are required"); return; }
    const cleanPass = msPassword.replace(/\s+/g, "");
    setTestingFrom("microsoft");
    setScreen("any-testing");
    setTestingStatus(["Verifying your Outlook credentials..."]); setTestingError(null); setTestingDone(false);
    const testRes = await fetch("/api/email-accounts/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smtpHost: "smtp.office365.com", smtpPort: 587, smtpUser: msEmail, smtpPass: cleanPass, encryption: "starttls", imapHost: "outlook.office365.com", imapPort: 993, imapUser: msEmail, imapPass: cleanPass }) });
    const testData = await testRes.json();
    if (!testData.success) { setTestingStatus(prev => [...prev, "Verification failed"]); setTestingError(testData.error || "Invalid credentials"); return; }
    setTestingStatus(prev => [...prev, "Credentials verified!"]);
    await new Promise(r => setTimeout(r, 600));
    setTestingStatus(prev => [...prev, "Connecting your account..."]);
    await new Promise(r => setTimeout(r, 600));
    const ok = await connectAccount({ email: msEmail, provider: "Outlook", smtpHost: "smtp.office365.com", smtpPort: 587, smtpUser: msEmail, smtpPass: cleanPass, imapHost: "outlook.office365.com", imapPort: 993, imapUser: msEmail, imapPass: cleanPass, dailySendLimit: 50 });
    if (!ok) { setTestingError("Failed to save account"); return; }
    setTestingStatus(prev => [...prev, "Account connected successfully!"]); setTestingDone(true);
  }

  async function handleGoogleAppPassword() {
    if (!gmailEmail || !gmailPassword) { alert("Email and app password are required"); return; }
    const cleanPass = gmailPassword.replace(/\s+/g, "");
    setTestingFrom("gmail"); setScreen("any-testing");
    setTestingStatus(["Verifying your Gmail credentials..."]); setTestingError(null); setTestingDone(false);
    const testRes = await fetch("/api/email-accounts/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: gmailEmail, smtpPass: cleanPass }) });
    const testData = await testRes.json();
    if (!testData.success) { setTestingStatus(prev => [...prev, "Verification failed"]); setTestingError(testData.error || "Invalid credentials"); return; }
    setTestingStatus(prev => [...prev, "Credentials verified!"]);
    await new Promise(r => setTimeout(r, 600));
    setTestingStatus(prev => [...prev, "Connecting your account..."]);
    await new Promise(r => setTimeout(r, 600));
    const ok = await connectAccount({ email: gmailEmail, provider: "Gmail", smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: gmailEmail, smtpPass: cleanPass, dailySendLimit: 50, displayName: gmailName || undefined });
    if (!ok) { setTestingError("Failed to save account"); return; }
    setTestingStatus(prev => [...prev, "Account connected successfully!"]); setTestingDone(true);
  }

  async function testImapConnection(navigateOnSuccess?: boolean) {
    if (imapStatus === "testing") return;
    if (!imapForm.host || !imapForm.username || !imapForm.password) return;
    setImapStatus("testing"); setImapStatusMsg("Testing IMAP connection...");
    try {
      const res = await fetch("/api/email-accounts/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imapHost: imapForm.host, imapPort: parseInt(imapForm.port) || 993, imapUser: imapForm.username, imapPass: imapForm.password }) });
      const data = await res.json();
      if (data.success) {
        setImapStatus("success"); setImapStatusMsg("IMAP connection successful!");
        if (!smtpForm.username) setSmtpForm(prev => ({ ...prev, username: imapForm.username }));
        if (!smtpForm.password) setSmtpForm(prev => ({ ...prev, password: imapForm.password }));
        if (navigateOnSuccess) { setTimeout(() => { setImapStatus("idle"); setScreen("any-smtp"); }, 600); }
        else { setTimeout(() => setImapStatus("idle"), 4000); }
      } else {
        setImapStatus("error"); setImapStatusMsg(data.errors?.find((e: string) => e.includes("IMAP")) || data.error || "IMAP connection failed");
        setTimeout(() => setImapStatus("idle"), 4000);
      }
    } catch { setImapStatus("error"); setImapStatusMsg("IMAP connection failed"); setTimeout(() => setImapStatus("idle"), 4000); }
  }

  useEffect(() => {
    if (!imapForm.host || !imapForm.port || !imapForm.username || !imapForm.password) return;
    const timer = setTimeout(() => testImapConnection(), 1500);
    return () => clearTimeout(timer);
  }, [imapForm.host, imapForm.port, imapForm.username, imapForm.password]);

  useEffect(() => {
    if (screen === "any-smtp") {
      if (!smtpForm.username && imapForm.username) setSmtpForm(prev => ({ ...prev, username: imapForm.username }));
      if (!smtpForm.password && imapForm.password) setSmtpForm(prev => ({ ...prev, password: imapForm.password }));
    }
  }, [screen]);

  async function handleAnyConnect() {
    if (smtpStatus === "testing" || smtpStatus === "success") return;
    const smtpUsername = smtpForm.username || imapForm.username;
    const smtpPassword = smtpForm.password || imapForm.password;
    if (!singleEmail || !imapForm.host || !smtpForm.host) { alert("Fill in required fields"); return; }
    setSmtpStatus("testing"); setSmtpStatusMsg("Testing SMTP connection...");
    const testRes = await fetch("/api/email-accounts/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smtpHost: smtpForm.host, smtpPort: parseInt(smtpForm.port) || 587, smtpUser: smtpUsername, smtpPass: smtpPassword, imapHost: imapForm.host, imapPort: parseInt(imapForm.port) || 993, imapUser: imapForm.username, imapPass: imapForm.password }) });
    const testData = await testRes.json();
    if (!testData.success) { setSmtpStatus("error"); setSmtpStatusMsg(testData.error || "SMTP connection failed"); setTimeout(() => setSmtpStatus("idle"), 4000); return; }
    setSmtpStatus("success"); setSmtpStatusMsg("Account linked successfully!");
    const ok = await connectAccount({ email: singleEmail, provider: "IMAP", smtpHost: smtpForm.host, smtpPort: parseInt(smtpForm.port) || 587, smtpUser: smtpUsername, smtpPass: smtpPassword, imapHost: imapForm.host, imapPort: parseInt(imapForm.port) || 993, imapUser: imapForm.username, imapPass: imapForm.password, dailySendLimit: 30, displayName: singleName || undefined });
    if (ok) { setTimeout(() => { setShowModal(false); resetAnyForms(); }, 1000); }
  }

  async function refreshAccounts() {
    const res = await fetch("/api/email-accounts");
    if (res.ok) setAccounts(await res.json());
  }

  async function handleRemove(id: string) {
    setConfirmRemove(id);
  }

  async function doRemove(id: string) {
    await fetch(`/api/email-accounts?id=${id}`, { method: "DELETE" });
    refreshAccounts();
    toast("Account removed", "success");
    setConfirmRemove(null);
  }

  async function handleWarmupToggle(id: string) {
    setToggling(prev => new Set(prev).add(id));
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, warmupEnabled: !a.warmupEnabled } : a));
    await fetch("/api/warmup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailAccountId: id, action: "toggle" }) });
    setToggling(prev => { const next = new Set(prev); next.delete(id); return next; });
    refreshAccounts();
  }

  async function handleBulkImport() {
    const valid = bulkAccounts.filter((a: any) => a.valid);
    const errors: { email: string; reason: string }[] = []; let success = 0;
    setBulkImporting(true);
    for (const acc of valid) {
      try {
        const res = await fetch("/api/email-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: acc.email, provider: "IMAP", smtpHost: acc.smtpHost || undefined, smtpPort: acc.smtpPort ? parseInt(acc.smtpPort) : undefined, smtpUser: acc.smtpUsername || acc.email, smtpPass: acc.smtpPassword || undefined, imapHost: acc.imapHost || undefined, imapPort: acc.imapPort ? parseInt(acc.imapPort) : undefined, imapUser: acc.imapUsername || acc.email, imapPass: acc.imapPassword || undefined, dailySendLimit: 30, displayName: [acc.firstName, acc.lastName].filter(Boolean).join(" ") || undefined }) });
        if (res.ok) success++; else { const err = await res.json(); errors.push({ email: acc.email, reason: err.error || "Unknown error" }); }
      } catch { errors.push({ email: acc.email, reason: "Network error" }); }
    }
    const failed = bulkAccounts.filter((a: any) => !a.valid);
    failed.forEach((a: any) => errors.push({ email: a.email, reason: a.error }));
    setBulkResults({ total: bulkAccounts.length, success, failed: bulkAccounts.length - success, errors });
    refreshAccounts(); setBulkImporting(false); setScreen("any-bulk-results");
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Email Accounts</h1>
          <p className="text-sm text-muted mt-1.5">{accounts.length} connected</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">+ Connect Account</button>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <h3>No accounts connected</h3>
            <p>Connect your first email account to start sending.</p>
            <button onClick={() => openModal()} className="btn btn-primary">Connect Account</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                  <tr>
                    <th>Email</th>
                    <th>Emails Sent</th>
                    <th>Daily Limit</th>
                    <th>Warmup</th>
                    <th>Health Score</th>
                    <th></th>
                  </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/email-accounts/${encodeURIComponent(a.email)}`)}>
                    <td className="font-medium">{a.email}</td>
                    <td className="text-muted">{a.sent ?? 0}</td>
                    <td className="text-muted">{a.dailySendLimit}</td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); handleWarmupToggle(a.id); }} disabled={toggling.has(a.id)}
                        className={`relative w-9 h-5 rounded-full transition-colors align-middle ${a.warmupEnabled ? "bg-blue-accent" : "bg-border"} ${toggling.has(a.id) ? "opacity-50" : ""}`}>
                        <span className={`absolute block w-3.5 h-3.5 bg-white rounded-full top-1/2 -translate-y-1/2 transition-all ${a.warmupEnabled ? "left-[19px]" : "left-[3px]"}`} />
                      </button>
                    </td>
                    <td className="text-muted">{a.healthScore ?? "—"}</td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); handleRemove(a.id); }} className="text-xs text-muted-2 hover:text-red-600 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connect Modal — same as before */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowModal(false)}>
          <div className="bg-cream border border-border rounded-lg w-[90%] max-w-[440px] shadow-xl flex flex-col" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh" }}>
            <div className="flex items-center gap-3 px-8 pt-7 pb-4 shrink-0">
              {screen !== "select" && (
                <button onClick={() => {
                  if (screen === "google-app-password") setScreen("google");
                  else if (screen === "microsoft") setScreen("select");
                  else if (screen === "any-imap") setScreen("any-single");
                  else if (screen === "any-smtp") setScreen("any-imap");
                  else if (screen === "any-bulk-review") setScreen("any-bulk");
                  else if (screen === "any-testing") { setTestingDone(false); setTestingError(null); setScreen(testingFrom === "gmail" ? "google-app-password" : testingFrom === "microsoft" ? "microsoft" : "any-smtp"); }
                  else if (screen === "any-bulk-results") { setBulkResults(null); setScreen("any-bulk"); }
                  else setScreen("select");
                }} className="text-muted hover:text-blue-accent transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-2 block">{screen.startsWith("any-") ? (testingFrom === "gmail" ? "Gmail" : testingFrom === "microsoft" ? "Microsoft" : "IMAP / SMTP") : screen === "microsoft" ? "Microsoft" : "Select another provider"}</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-blue-accent transition-colors shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {screen === "select" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Connect a provider</h2>
                <p className="text-sm text-muted mb-6">Choose your email provider to get started.</p>
                <ProviderCard icon={<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/></svg>} name="Google" subtitle="Gmail / G-Suite" onClick={() => setScreen("google")} />
                <ProviderCard icon={<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#0078D4" d="M11.5 2H21a1 1 0 0 1 1 1v7.5l-5 3-5.5-3V2z"/><path fill="#0078D4" d="M2 11.5h9v9H3a1 1 0 0 1-1-1v-8z"/></svg>} name="Microsoft" subtitle="Office 365 / Outlook" onClick={() => setScreen("microsoft")} />
                <ProviderCard icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>} name="Any Provider" subtitle="IMAP / SMTP" onClick={() => setScreen("any-provider")} />
              </div>
            )}

            {screen === "google" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Connect Your Google Account</h2>
                <p className="text-sm text-muted mb-6">Gmail / G-Suite</p>
                <OptionCard title="App Password" description="Use an app password. Requires 2-factor authentication on your Google account." onClick={() => setScreen("google-app-password")} />
              </div>
            )}

            {screen === "google-app-password" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Connect Your Google Account</h2>
                <p className="text-sm text-muted mb-6">Gmail / G-Suite</p>
                <div className="bg-blue-light border border-blue-accent/20 rounded-lg p-4 mb-5">
                  <h4 className="text-xs font-medium text-blue-accent mb-2">How to get your Google App Password</h4>
                  <ol className="text-xs text-muted space-y-1.5 list-decimal ml-4">
                    <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-accent hover:underline font-medium">Google App Passwords</a> (opens in new tab)</li>
                    <li>Turn on <span className="text-ink font-medium">2-Step Verification</span> if not already enabled</li>
                    <li>Select <span className="text-ink font-medium">Mail</span> as the app and <span className="text-ink font-medium">Other</span> as the device</li>
                    <li>Copy the generated 16-character password and paste it below</li>
                  </ol>
                </div>
                <div className="space-y-4">
                  <div className="field-group"><label className="block text-xs text-muted mb-2">Send as name</label><input value={gmailName} onChange={e => setGmailName(e.target.value)} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="Your display name" /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">Email *</label><input value={gmailEmail} onChange={e => setGmailEmail(e.target.value)} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="you@gmail.com" /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">App Password *</label><input type="password" value={gmailPassword} onChange={e => setGmailPassword(e.target.value)} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="xxxx xxxx xxxx xxxx" /></div>
                </div>
                <button onClick={handleGoogleAppPassword} className="btn btn-primary w-full mt-6">Connect</button>
              </div>
            )}

            {screen === "microsoft" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Connect Your Microsoft Account</h2>
                <p className="text-sm text-muted mb-1">Office 365 / Outlook</p>
                <p className="text-xs text-muted-2 mb-6">Sign in with Microsoft to connect your account. No password needed.</p>
                {msOAuthStatus !== "idle" && (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4 ${msOAuthStatus === "connecting" ? "bg-blue-50 text-blue-700 border border-blue-200" : msOAuthStatus === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {msOAuthStatus === "connecting" && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>}
                    {msOAuthStatus === "success" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                    {msOAuthStatus === "error" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    <span>{msOAuthMsg}</span>
                  </div>
                )}
                <button onClick={handleMicrosoftOAuth} disabled={msOAuthStatus === "connecting"} className="w-full flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-transparent hover:bg-cream-2 transition-colors cursor-pointer mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" rx="1.5" fill="#F25022"/><rect x="13" y="1" width="10" height="10" rx="1.5" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" rx="1.5" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" rx="1.5" fill="#FFB900"/></svg>
                  <span className="text-sm font-medium">{msOAuthStatus === "connecting" ? "Connecting..." : "Sign in with Microsoft"}</span>
                </button>
                <p className="text-xs text-muted text-center">We only request access to send and read emails for warmup and spam prevention.</p>
              </div>
            )}

            {screen === "any-provider" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Connect Any Provider</h2>
                <p className="text-sm text-muted mb-6">IMAP / SMTP</p>
                <OptionCard title="Single Account" description="Connect one IMAP/SMTP account manually." onClick={() => setScreen("any-single")} />
                <OptionCard title="Bulk Import from CSV" description="Import multiple accounts via CSV file." onClick={() => setScreen("any-bulk")} />
              </div>
            )}

            {screen === "any-single" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Connect Any Provider Account</h2>
                <p className="text-sm text-muted mb-6">IMAP / SMTP</p>
                <div className="space-y-4">
                  <div className="field-group"><label className="block text-xs text-muted mb-2">Send as name *</label><input value={singleName} onChange={e => setSingleName(e.target.value)} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="Your display name" /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">Email *</label><input value={singleEmail} onChange={e => setSingleEmail(e.target.value)} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="you@website.com" /></div>
                </div>
                <button onClick={() => setScreen("any-imap")} className="btn btn-primary w-full mt-6">Next &gt;</button>
              </div>
            )}

            {screen === "any-imap" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">IMAP</h2>
                <p className="text-sm text-muted mb-6">IMAP Setup</p>
                {imapStatus !== "idle" && (
                  <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm transition-all ${imapStatus === "testing" ? "bg-blue-50 text-blue-700 border border-blue-200" : imapStatus === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {imapStatus === "testing" && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>}
                    {imapStatus === "success" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                    {imapStatus === "error" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    <span>{imapStatusMsg}</span>
                  </div>
                )}
                <div className="bg-cream-2 border border-border rounded-lg p-4 mb-5">
                  <h4 className="text-xs font-medium text-muted mb-2">Where to find these settings</h4>
                  <div className="text-xs text-muted space-y-2"><p><span className="text-ink font-medium">Gmail:</span> imap.gmail.com / Port 993</p><p><span className="text-ink font-medium">Outlook:</span> outlook.office365.com / Port 993</p><p><span className="text-ink font-medium">Other:</span> Check your provider's IMAP settings</p></div>
                </div>
                <div className="space-y-4">
                  <div className="field-group"><label className="block text-xs text-muted mb-2">IMAP Username *</label><input value={imapForm.username} onChange={e => setImapForm(prev => ({ ...prev, username: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder={singleEmail || "user@website.com"} /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">IMAP Password *</label><input type="password" value={imapForm.password} onChange={e => setImapForm(prev => ({ ...prev, password: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="••••••••" /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">IMAP Host *</label><input value={imapForm.host} onChange={e => setImapForm(prev => ({ ...prev, host: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="imap.website.com" /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">IMAP Port *</label><input value={imapForm.port} onChange={e => setImapForm(prev => ({ ...prev, port: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="993" /></div>
                </div>
                <button onClick={() => { if (imapStatus !== "testing") testImapConnection(true); }} className="btn btn-primary w-full mt-6">{imapStatus === "testing" ? "Testing..." : imapStatus === "success" ? "Success! Continue..." : "Next >"}</button>
              </div>
            )}

            {screen === "any-smtp" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">SMTP</h2>
                <p className="text-sm text-muted mb-6">SMTP Setup</p>
                {smtpStatus !== "idle" && (
                  <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm transition-all ${smtpStatus === "testing" ? "bg-blue-50 text-blue-700 border border-blue-200" : smtpStatus === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {smtpStatus === "testing" && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>}
                    {smtpStatus === "success" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                    {smtpStatus === "error" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    <span>{smtpStatusMsg}</span>
                  </div>
                )}
                <div className="bg-cream-2 border border-border rounded-lg p-4 mb-5">
                  <h4 className="text-xs font-medium text-muted mb-2">Where to find these settings</h4>
                  <div className="text-xs text-muted space-y-2"><p><span className="text-ink font-medium">Gmail:</span> smtp.gmail.com / Port 587 (STARTTLS)</p><p><span className="text-ink font-medium">Outlook:</span> smtp.office365.com / Port 587 (STARTTLS)</p></div>
                </div>
                <div className="space-y-4">
                  <div className="field-group"><label className="block text-xs text-muted mb-2">SMTP Username *</label><input value={smtpForm.username} onChange={e => setSmtpForm(prev => ({ ...prev, username: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder={imapForm.username || "user@website.com"} /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">SMTP Password *</label><input type="password" value={smtpForm.password} onChange={e => setSmtpForm(prev => ({ ...prev, password: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="••••••••" /></div>
                  <div className="field-group"><label className="block text-xs text-muted mb-2">SMTP Host *</label><input value={smtpForm.host} onChange={e => setSmtpForm(prev => ({ ...prev, host: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="smtp.website.com" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="field-group"><label className="block text-xs text-muted mb-2">SMTP Port *</label><input value={smtpForm.port} onChange={e => setSmtpForm(prev => ({ ...prev, port: e.target.value }))} className="w-full bg-transparent border-b border-border pb-2.5 text-sm outline-none focus:border-blue-accent" placeholder="587" /></div>
                    <div className="field-group"><label className="block text-xs text-muted mb-2">Encryption</label><Select value={smtpForm.encryption} onChange={v => setSmtpForm(prev => ({ ...prev, encryption: v as Encryption }))} options={[{ value: "none", label: "None" }, { value: "ssl", label: "SSL/TLS" }, { value: "starttls", label: "STARTTLS" }]} placeholder="Select encryption" /></div>
                  </div>
                </div>
                <button onClick={handleAnyConnect} className="btn btn-primary w-full mt-6">{smtpStatus === "testing" ? "Testing..." : "Connect"}</button>
              </div>
            )}

            {screen === "any-testing" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">{testingError ? "Connection Failed" : testingDone ? "Connection Successful" : "Testing Connection..."}</h2>
                <div className="space-y-3 mb-6">
                  {testingStatus.map((msg, i) => {
                    const isLast = i === testingStatus.length - 1;
                    const isError = testingError && isLast;
                    const isDone = !isError && (testingDone || (!testingDone && !testingError && !isLast));
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        {isError ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> : isDone ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg> : <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>}
                        <span className={isDone ? "text-ink font-medium" : isError ? "text-red-600" : "text-muted"}>{msg}</span>
                      </div>
                    );
                  })}
                </div>
                {testingDone && !testingError && <button onClick={() => { setShowModal(false); resetAnyForms(); }} className="btn btn-primary w-full">Done</button>}
                {testingError && <button onClick={() => { setTestingDone(false); setTestingError(null); setScreen(testingFrom === "gmail" ? "google-app-password" : testingFrom === "microsoft" ? "microsoft" : "any-smtp"); }} className="btn btn-ghost w-full mt-2">Try Again</button>}
              </div>
            )}

            {screen === "any-bulk" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Bulk Import from CSV</h2>
                <p className="text-sm text-muted mb-4">Import multiple IMAP/SMTP accounts</p>
                <div className="text-xs text-muted mb-4">Upload a CSV file with columns: First Name, Last Name, Email, IMAP Username, IMAP Password, IMAP Host, IMAP Port, SMTP Username, SMTP Password, SMTP Host, SMTP Port, Encryption</div>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-6 cursor-pointer hover:bg-cream-2 transition-colors" onClick={() => document.getElementById("csv-upload")?.click()}>
                  <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkFile(f); }} />
                  {bulkFile ? <div><p className="text-sm font-medium text-ink">{bulkFile.name}</p><p className="text-xs text-muted mt-1">{(bulkFile.size / 1024).toFixed(1)} KB</p></div> : <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted-2 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><p className="text-sm text-muted">Click to upload CSV</p></div>}
                </div>
                <button onClick={async () => {
                  if (!bulkFile) return;
                  const text = await bulkFile.text();
                  const lines = text.split("\n").filter((l: string) => l.trim());
                  if (lines.length < 2) { alert("CSV is empty or missing header row"); return; }
                  const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase().replace(/\s+/g, ""));
                  const accounts = [];
                  for (let i = 1; i < lines.length; i++) {
                    const vals = lines[i].split(",").map((v: string) => v.trim());
                    const row: any = { row: i + 1 };
                    headers.forEach((h: string, idx: number) => row[h] = vals[idx] || "");
                    const email = row["email"] || "";
                    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                    accounts.push({ email, firstName: row["firstname"] || "", lastName: row["lastname"] || "", imapUsername: row["imapusername"] || "", imapPassword: row["imappassword"] || "", imapHost: row["imaphost"] || "", imapPort: row["imapport"] || "993", smtpUsername: row["smtpusername"] || "", smtpPassword: row["smtppassword"] || "", smtpHost: row["smtphost"] || "", smtpPort: row["smtpport"] || "587", encryption: row["encryption"] || "ssl", valid, error: valid ? "" : "Invalid email format" });
                  }
                  setBulkAccounts(accounts); setScreen("any-bulk-review");
                }} className={`btn w-full ${bulkFile ? "btn-primary" : "btn-ghost opacity-50"}`} disabled={!bulkFile}>Next &gt;</button>
              </div>
            )}

            {screen === "any-bulk-review" && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Review Import</h2>
                <p className="text-sm text-muted mb-4">{bulkAccounts.length} accounts found</p>
                <div className="table-wrap mb-6">
                  <table><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{bulkAccounts.map((a: any, i: number) => (<tr key={i}><td className="text-sm">{a.email}</td><td>{a.valid ? <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Valid</span> : <div><span className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Invalid</span><p className="text-[11px] text-red-500 mt-0.5">{a.error}</p></div>}</td></tr>))}</tbody></table>
                </div>
                <button onClick={handleBulkImport} className="btn btn-primary w-full">{bulkImporting ? "Importing..." : "Import >"}</button>
              </div>
            )}

            {screen === "any-bulk-results" && bulkResults && (
              <div className="px-8 pb-8 overflow-y-auto">
                <h2 className="text-xl font-normal mb-1">Import Complete</h2>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-cream-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-normal">{bulkResults.total}</div><div className="text-xs text-muted mt-1">Total</div></div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center"><div className="text-2xl font-normal text-green-700">{bulkResults.success}</div><div className="text-xs text-green-600 mt-1">Imported</div></div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center"><div className="text-2xl font-normal text-red-600">{bulkResults.failed}</div><div className="text-xs text-red-500 mt-1">Failed</div></div>
                </div>
                <button onClick={() => { setShowModal(false); resetAnyForms(); }} className="btn btn-primary w-full">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirmRemove}
        title="Remove account?"
        message="This will permanently disconnect this email account. Warmup and sending will stop."
        confirmLabel="Remove"
        onConfirm={() => confirmRemove && doRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
        variant="danger"
      />
    </div>
  );
}

function ProviderCard({ icon, name, subtitle, onClick }: { icon: React.ReactNode; name: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-transparent hover:bg-cream-2 transition-colors text-left mb-3 cursor-pointer">
      <div className="w-10 h-10 rounded-full bg-cream-2 border border-border flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0"><span className="text-sm font-medium">{name}</span><p className="text-xs text-muted mt-0.5">{subtitle}</p></div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-2 shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  );
}

function OptionCard({ title, description, tag, onClick }: { title: string; description: string; tag?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-transparent hover:bg-cream-2 transition-colors text-left mb-3 cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><span className="text-sm font-medium">{title}</span>{tag && <span className="text-[10px] font-medium text-blue-accent bg-blue-light px-2 py-0.5 rounded-full capitalize">{tag}</span>}</div>
        <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-2 shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  );
}
