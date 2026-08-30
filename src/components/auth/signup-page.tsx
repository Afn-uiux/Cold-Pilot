"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { signup } from "@/app/actions/auth";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-client";

function simpleHash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

async function computeFingerprint(): Promise<string> {
  const signals: string[] = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency || ""),
    String(navigator.platform || ""),
    String((navigator as Navigator & { deviceMemory?: number }).deviceMemory || ""),
  ];
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(100, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("coldpilot-fp", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("coldpilot-fp", 4, 17);
      signals.push(canvas.toDataURL());
    }
  } catch {}
  const data = signals.join("|");
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {}
  }
  return simpleHash(data);
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [fingerprint, setFingerprint] = useState("");
  const currency = useCurrency();

  useEffect(() => {
    let cancelled = false;
    computeFingerprint().then(fp => {
      if (!cancelled) setFingerprint(fp);
    });
    return () => { cancelled = true; };
  }, []);

  function getPasswordStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await signup(form);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      // Fresh signups redirect via the server action's signIn. This fallback
      // covers edge paths (e.g. an email that already has an account) so the
      // form still lands somewhere instead of silently hanging — the proxy then
      // gates /dashboard and shows login if there is no session.
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none" }}>
          Coldpilot
        </Link>
        <Link href="/auth/login" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none" }}
          onMouseEnter={e => (e.target as HTMLElement).style.color = "#0F1929"}
          onMouseLeave={e => (e.target as HTMLElement).style.color = "#5A6B87"}>
          Log in
        </Link>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px clamp(20px,4vw,40px) 80px", position: "relative", overflow: "hidden" }}>

        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
          <span style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A9BB5", display: "block" }}>
            Get started
          </span>
          <h1 style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(32px,5vw,40px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 16, color: "#0F1929" }}>
            Create your account
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, color: "#5A6B87", lineHeight: 1.6 }}>{formatPrice(PLANS.starter.price, currency)}/mo flat. No credit card to start.</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 24 }}>
            <input type="hidden" name="fingerprint" value={fingerprint} />
            {error && (
              <div style={{ fontSize: 13, color: "#C62828", background: "rgba(198,40,40,0.06)", padding: "10px 14px", borderRadius: 6 }}>{error}</div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 13, color: "#5A6B87", marginBottom: 8 }} htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" autoComplete="name" placeholder="Jane Smith"
                style={{ width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929", background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)", padding: "10px 0", outline: "none", borderRadius: 0 }}
                onFocus={e => e.target.style.borderBottomColor = "#0F1929"}
                onBlur={e => e.target.style.borderBottomColor = "rgba(15,25,41,0.08)"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "#5A6B87", marginBottom: 8 }} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                style={{ width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929", background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)", padding: "10px 0", outline: "none", borderRadius: 0 }}
                onFocus={e => e.target.style.borderBottomColor = "#0F1929"}
                onBlur={e => e.target.style.borderBottomColor = "rgba(15,25,41,0.08)"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "#5A6B87", marginBottom: 8 }} htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input id="password" name="password" type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password" placeholder="At least 8 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordStrength(getPasswordStrength(e.target.value)); }}
                  style={{ width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929", background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)", padding: "10px 36px 10px 0", outline: "none", borderRadius: 0 }}
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
              {password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{
                        height: 3, flex: 1, borderRadius: 2,
                        background: passwordStrength >= i
                          ? passwordStrength <= 2 ? "#C62828" : passwordStrength <= 3 ? "#F59E0B" : "#2E7D32"
                          : "#E8E5E0",
                        transition: "background 0.2s",
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: passwordStrength <= 2 ? "#C62828" : passwordStrength <= 3 ? "#F59E0B" : "#2E7D32" }}>
                    {passwordStrength <= 1 ? "Very weak" : passwordStrength <= 2 ? "Weak" : passwordStrength <= 3 ? "Fair" : passwordStrength <= 4 ? "Strong" : "Very strong"}
                  </span>
                </div>
              )}
              {password.length === 0 && <p style={{ fontSize: 12, color: "#8A9BB5", marginTop: 8 }}>Use 8+ characters with a mix of letters and numbers.</p>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#8A9BB5", margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(15,25,41,0.08)" }} />
            <span>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(15,25,41,0.08)" }} />
          </div>

          <button type="button" onClick={() => signIn("google", { redirectTo: "/dashboard" })}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: 13, fontFamily: "inherit", fontSize: 14, fontWeight: 500,
              color: "#0F1929", background: "transparent", border: "1px solid rgba(15,25,41,0.08)",
              borderRadius: 6, cursor: "pointer", marginTop: 8
            }}
            onMouseEnter={e => (e.target as HTMLElement).style.borderColor = "#0F1929"}
            onMouseLeave={e => (e.target as HTMLElement).style.borderColor = "rgba(15,25,41,0.08)"}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </button>

          <p style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(15,25,41,0.08)", fontSize: 14, color: "#5A6B87", textAlign: "center" }}>
            Already have an account?{" "}
            <Link href="/auth/login" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.08)", paddingBottom: 1, textDecoration: "none" }}>Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
