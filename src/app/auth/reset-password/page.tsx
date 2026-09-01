"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"form" | "loading" | "success" | "error">("form");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setStatus("error");
      setMessage("This reset link is missing its token.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("success");
        setMessage("Your password has been reset. You can now log in.");
      } else {
        setStatus("error");
        setMessage(data.error || "This reset link is invalid or has expired.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif", padding: "40px clamp(20px,4vw,40px)" }}>
      <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
        {status === "form" && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", marginBottom: 8 }}>Set a new password</h1>
            <p style={{ fontSize: 15, color: "#5A6B87", marginBottom: 24 }}>Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                placeholder="New password (min 6 chars)"
                style={{ width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929", background: "transparent", border: "none", borderBottom: "1px solid rgba(15,25,41,0.08)", padding: "10px 0", outline: "none" }}
              />
              <button type="submit" style={{ padding: "10px 24px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#2563EB", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Reset password
              </button>
            </form>
          </>
        )}
        {status === "loading" && (
          <>
            <div style={{ width: 40, height: 40, border: "3px solid #E8E5E0", borderTopColor: "#0F1929", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ fontSize: 15, color: "#5A6B87" }}>Resetting your password...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", marginBottom: 8 }}>Password reset</h1>
            <p style={{ fontSize: 15, color: "#5A6B87", marginBottom: 24 }}>{message}</p>
            <Link href="/auth/login" style={{ display: "inline-block", padding: "10px 24px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#2563EB", borderRadius: 8, textDecoration: "none" }}>Back to login</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", marginBottom: 8 }}>Reset failed</h1>
            <p style={{ fontSize: 15, color: "#5A6B87", marginBottom: 24 }}>{message}</p>
            <Link href="/auth/login" style={{ display: "inline-block", padding: "10px 24px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#2563EB", borderRadius: 8, textDecoration: "none" }}>Back to login</Link>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #E8E5E0", borderTopColor: "#0F1929", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
