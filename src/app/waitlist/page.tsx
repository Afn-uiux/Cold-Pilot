"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/logo";

export default function WaitlistPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
      setMessage(
        data.duplicate
          ? "You're already on the list — we'll be in touch."
          : "You're on the list. We'll email you the moment we launch."
      );
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          <Logo height={22} />
        </Link>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px clamp(20px,4vw,40px) 80px", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(120px,20vw,240px)",
          color: "#0F1929", opacity: 0.025, pointerEvents: "none", whiteSpace: "nowrap"
        }}>soon</div>

        <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1, textAlign: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A9BB5", display: "block" }}>
            ColdPilot
          </span>
          <h1 style={{ fontSize: "clamp(32px,5vw,44px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 16, color: "#0F1929" }}>
            Relax — we&apos;re cooking.
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, color: "#5A6B87", lineHeight: 1.6 }}>
            ColdPilot isn&apos;t open just yet. Join the waitlist and we&apos;ll email you the moment your seat is ready.
          </p>

          {status === "done" ? (
            <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 8, background: "rgba(46,125,50,0.06)", textAlign: "left" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <div style={{ fontSize: 14, color: "#0F1929", lineHeight: 1.5 }}>{message}</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
              {status === "error" && (
                <div style={{ fontSize: 13, color: "#C62828", background: "rgba(198,40,40,0.06)", padding: "10px 14px", borderRadius: 6 }}>{message}</div>
              )}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                required
                autoComplete="name"
                placeholder="Full name"
                style={{
                  width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929",
                  background: "#fff", border: "1px solid rgba(15,25,41,0.12)",
                  padding: "13px 16px", outline: "none", borderRadius: 8
                }}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: "100%", fontFamily: "inherit", fontSize: 15, color: "#0F1929",
                  background: "#fff", border: "1px solid rgba(15,25,41,0.12)",
                  padding: "13px 16px", outline: "none", borderRadius: 8
                }}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                style={{
                  width: "100%", padding: 13, fontFamily: "inherit", fontSize: 14, fontWeight: 500,
                  color: "#fff", background: "#2563EB", border: "none", borderRadius: 8,
                  cursor: "pointer", opacity: status === "loading" ? 0.7 : 1
                }}
              >
                {status === "loading" ? "Joining…" : "Join the waitlist"}
              </button>
            </form>
          )}

          <p style={{ marginTop: 24, fontSize: 13, color: "#8A9BB5" }}>
            No spam, ever. One email when we launch.
          </p>
        </div>
      </main>
    </div>
  );
}
