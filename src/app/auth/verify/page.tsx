"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }
    fetch(`/api/auth/verify?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.message === "Email verified successfully") {
          setStatus("success");
          setMessage("Your email has been verified! You can now use all features.");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif", padding: "40px clamp(20px,4vw,40px)" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        {status === "loading" && (
          <>
            <div style={{ width: 40, height: 40, border: "3px solid #E8E5E0", borderTopColor: "#0F1929", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ fontSize: 15, color: "#5A6B87" }}>Verifying your email...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", marginBottom: 8 }}>Email verified</h1>
            <p style={{ fontSize: 15, color: "#5A6B87", marginBottom: 24 }}>{message}</p>
            <Link href="/dashboard" style={{ display: "inline-block", padding: "10px 24px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#0F1929", borderRadius: 8, textDecoration: "none" }}>Go to Dashboard</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", marginBottom: 8 }}>Verification failed</h1>
            <p style={{ fontSize: 15, color: "#5A6B87", marginBottom: 24 }}>{message}</p>
            <Link href="/auth/login" style={{ display: "inline-block", padding: "10px 24px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#0F1929", borderRadius: 8, textDecoration: "none" }}>Back to Login</Link>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #E8E5E0", borderTopColor: "#0F1929", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
