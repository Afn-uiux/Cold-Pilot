"use client";

import { useState, useEffect, useTransition } from "react";
import { demoLogin } from "@/app/actions/auth";
import Link from "next/link";
import Logo from "@/components/logo";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [verifyRequired, setVerifyRequired] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      window.history.replaceState({}, "", window.location.pathname);
      if (err === "invalid") setError("Invalid email or password");
      else if (err === "missing") setError("Email and password are required");
      else if (err === "rate_limited") setError("Too many attempts. Try again in a few minutes.");
      else setError("Login failed");
    }
    if (params.get("verify") === "required") {
      window.history.replaceState({}, "", window.location.pathname);
      setVerifyRequired(true);
    }
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleResendVerify() {
    if (!verifyEmail) return;
    setVerifyLoading(true);
    setVerifyMsg(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json().catch(() => ({}));
      setVerifyMsg(data.message || "Verification email sent.");
    } catch {
      setVerifyMsg("Something went wrong. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json().catch(() => ({}));
      setResetSent(true);
      setResetMsg(data.message || "If an account exists for that email, a password reset link was sent.");
    } catch {
      setResetMsg("Something went wrong. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    await demoLogin();
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          <Logo height={22} />
        </Link>
        <Link href="/auth/signup" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => (e.target as HTMLElement).style.color = "#0F1929"}
          onMouseLeave={e => (e.target as HTMLElement).style.color = "#5A6B87"}>
          Create account
        </Link>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px clamp(20px,4vw,40px) 80px", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(140px,22vw,260px)",
          color: "#0F1929", opacity: 0.025, pointerEvents: "none", whiteSpace: "nowrap"
        }}>welcome</div>

        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A9BB5", display: "block" }}>
            Account
          </span>
          <h1 style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(32px,5vw,40px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 16, color: "#0F1929" }}>
            Log in
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, color: "#5A6B87", lineHeight: 1.6 }}>Pick up where you left off.</p>

          {verifyRequired && (
            <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 16 }}>
              <img src="/email/verify-hero.png" alt="Verification link sent" width="140" style={{ width: 140, height: "auto", display: "block", margin: "0 auto 4px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 8, background: "rgba(46,125,50,0.06)" }}>
                <div style={{ fontSize: 14, color: "#0F1929", lineHeight: 1.5 }}>
                  <strong>Verify your email to continue.</strong>
                  <p style={{ fontSize: 13, color: "#5A6B87", margin: "4px 0 0" }}>
                    We sent a one-time verification link to{verifyEmail ? <> <strong>{verifyEmail}</strong></> : " your inbox"}. The link is valid for 24 hours. You&apos;ll be able to log in once your email is verified.
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleResendVerify} disabled={verifyLoading}
                style={{ width: "100%", padding: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 500, color: "#fff", background: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer", opacity: verifyLoading ? 0.7 : 1 }}>
                {verifyLoading ? "Sending..." : "Resend verification email"}
              </button>
              {verifyMsg && (
                <div style={{ fontSize: 13, color: "#2E7D32", background: "rgba(46,125,50,0.06)", padding: "10px 14px", borderRadius: 6 }}>{verifyMsg}</div>
              )}
              <p style={{ fontSize: 12, color: "#8A9BB5" }}>Wrong email? <Link href="/auth/signup" style={{ color: "#0F1929", textDecoration: "none" }}>Register with a different address</Link>.</p>
            </div>
          )}

          {!verifyRequired && (
          <>
          <form action="/api/auth/login" method="POST" style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 24 }}>
            {error && (
              <div style={{ fontSize: 13, color: "#C62828", background: "rgba(198,40,40,0.06)", padding: "10px 14px", borderRadius: 6 }}>{error}</div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 13, color: "#5A6B87", marginBottom: 8 }} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                style={{
                  width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929",
                  background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)",
                  padding: "10px 0", outline: "none", borderRadius: 0
                }}
                onFocus={e => e.target.style.borderBottomColor = "#0F1929"}
                onBlur={e => e.target.style.borderBottomColor = "rgba(15,25,41,0.08)"} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: "#5A6B87", marginBottom: 8 }} htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input id="password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Your password"
                  style={{
                    width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929",
                    background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)",
                    padding: "10px 36px 10px 0", outline: "none", borderRadius: 0
                  }}
                  onFocus={e => e.target.style.borderBottomColor = "#0F1929"}
                  onBlur={e => e.target.style.borderBottomColor = "rgba(15,25,41,0.08)"} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#8A9BB5", display: "flex" }}
                  tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5A6B87", cursor: "pointer" }}>
                <input type="checkbox" name="remember" style={{ width: 14, height: 14, accentColor: "#2563EB" }} />
                Remember me
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading || isPending} style={{ width: "100%", opacity: loading || isPending ? 0.7 : 1 }}>
              {loading || isPending ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button onClick={() => { setResetOpen(true); setResetMsg(null); setResetEmail(""); setResetSent(false); }}
              style={{ fontSize: 13, color: "#5A6B87", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = "#0F1929"}
              onMouseLeave={e => (e.target as HTMLElement).style.color = "#5A6B87"}>
              Forgot password?
            </button>
          </div>

          <p style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(15,25,41,0.08)", fontSize: 14, color: "#5A6B87", textAlign: "center" }}>
            No account?{" "}
            <Link href="/auth/signup" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.08)", paddingBottom: 1, textDecoration: "none" }}>Sign up free</Link>
          </p>
          </>
          )}
        </div>
      </main>

      {resetOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => { setResetOpen(false); setResetSent(false); setResetMsg(null); }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 32, width: "100%", maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: "#0F1929", marginBottom: 4 }}>Reset password</h3>
            <p style={{ fontSize: 13, color: "#5A6B87", marginBottom: 20 }}>Enter your email and we&apos;ll send you a link to reset your password.</p>
            {resetMsg && (
              <div style={{ fontSize: 13, color: resetSent ? "#2E7D32" : "#C62828", background: resetSent ? "rgba(46,125,50,0.06)" : "rgba(198,40,40,0.06)", padding: "10px 14px", borderRadius: 6, marginBottom: 16 }}>{resetMsg}</div>
            )}
            {!resetSent && (
              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <input value={resetEmail} onChange={e => setResetEmail(e.target.value)} type="email" required placeholder="Email"
                  style={{ width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929", background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)", padding: "10px 0", outline: "none" }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" onClick={() => setResetOpen(false)}
                    style={{ padding: "8px 16px", fontSize: 13, color: "#5A6B87", background: "none", border: "1px solid rgba(15,25,41,0.08)", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={resetLoading}
                    style={{ padding: "8px 16px", fontSize: 13, color: "#fff", background: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer" }}>{resetLoading ? "Sending..." : "Send reset link"}</button>
                </div>
              </form>
            )}
            {resetSent && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setResetOpen(false); setResetSent(false); setResetMsg(null); }}
                  style={{ padding: "8px 16px", fontSize: 13, color: "#fff", background: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer" }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
