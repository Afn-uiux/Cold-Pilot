"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#F8FAFC",
      fontFamily: "'Geist', system-ui, sans-serif",
      padding: "40px clamp(20px,4vw,40px)",
      textAlign: "center",
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 72,
        fontWeight: 500,
        color: "#E4E2DC",
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}>500</span>
      <h1 style={{
        fontSize: "clamp(24px,3.5vw,32px)",
        fontWeight: 400,
        letterSpacing: "-0.02em",
        marginTop: 16,
        color: "#0F1929",
      }}>Something went wrong</h1>
      <p style={{ fontSize: 15, color: "#5A6B87", marginTop: 12, maxWidth: 400, lineHeight: 1.6 }}>
        An unexpected error occurred. Please try again, or head back home.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        <button
          onClick={reset}
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 500,
            color: "#fff",
            background: "#2563EB",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 500,
            color: "#0F1929",
            background: "transparent",
            border: "1px solid #E4E2DC",
            borderRadius: 8,
            textDecoration: "none",
            transition: "background 0.15s",
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
