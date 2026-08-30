"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function getSafeNext(raw: string | null): string | null {
  if (!raw) return null;
  // Only allow same-origin, single-slash relative paths. Rejects "//evil.com",
  // "https://evil.com", backslashes, and protocol-relative URLs.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return null;
  }
  return raw;
}

function SupabaseCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const next = getSafeNext(searchParams.get("next")) || "/dashboard";
  const [status, setStatus] = useState("Signing in...");

  useEffect(() => {
    if (!code) { router.push("/auth/login"); return; }

    if (!supabase) { setStatus("Supabase not configured"); return; }
    const sb = supabase;

    sb.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (error) { setStatus("Auth failed"); return; }

      const { data: { user } } = await sb.auth.getUser();
      if (!user?.email) { setStatus("No email"); return; }

      const res = await fetch("/api/auth/supabase-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.full_name || user.email.split("@")[0],
          avatar: user.user_metadata?.avatar_url || null,
        }),
      });
      const dbUser = await res.json();

      if (dbUser.password) {
        await signIn("credentials", {
          email: user.email,
          password: dbUser.password,
          redirect: false,
        });
      }

      window.location.href = next;
    });
  }, [code, next, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Geist', sans-serif", color: "#6B6578", fontSize: 14 }}>
      {status}
    </div>
  );
}

export default function SupabaseCallback() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Geist', sans-serif", color: "#6B6578", fontSize: 14 }}>Loading...</div>}>
      <SupabaseCallbackInner />
    </Suspense>
  );
}
