"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { login, demoLogin } from "@/app/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await login(form);
    if (result?.error) {
      setError(result.error);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    await demoLogin();
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      {/* Top bar */}
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none" }}>
          Coldpilot
        </Link>
        <Link href="/auth/signup" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => (e.target as HTMLElement).style.color = "#0F1929"}
          onMouseLeave={e => (e.target as HTMLElement).style.color = "#5A6B87"}>
          Create account
        </Link>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px clamp(20px,4vw,40px) 80px", position: "relative", overflow: "hidden" }}>
        {/* Background watermark */}
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

          <form onSubmit={handleSubmit} style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 24 }}>
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
              <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="Your password"
                style={{
                  width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929",
                  background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)",
                  padding: "10px 0", outline: "none", borderRadius: 0
                }}
                onFocus={e => e.target.style.borderBottomColor = "#0F1929"}
                onBlur={e => e.target.style.borderBottomColor = "rgba(15,25,41,0.08)"} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Log in</button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#8A9BB5", margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(15,25,41,0.08)" }} />
            <span>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(15,25,41,0.08)" }} />
          </div>

          <button type="button" onClick={() => signIn("google", { redirectTo: "/dashboard" }).catch(() => {})}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: 13, fontFamily: "inherit", fontSize: 14, fontWeight: 500,
              color: "#0F1929", background: "transparent", border: "1px solid rgba(15,25,41,0.08)",
              borderRadius: 6, cursor: "pointer", marginTop: 8
            }}
            onMouseEnter={e => (e.target as HTMLElement).style.borderColor = "#0F1929"}
            onMouseLeave={e => (e.target as HTMLElement).style.borderColor = "rgba(15,25,41,0.08)"}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <p style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(15,25,41,0.08)", fontSize: 14, color: "#5A6B87", textAlign: "center" }}>
            No account?{" "}
            <Link href="/auth/signup" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.08)", paddingBottom: 1, textDecoration: "none" }}>Sign up free</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
