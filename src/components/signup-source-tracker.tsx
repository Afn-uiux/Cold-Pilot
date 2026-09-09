"use client";

import { useEffect } from "react";

// First-touch signup attribution: on the first page the visitor lands on,
// capture UTM params + HTTP referrer into a cookie so the server can store
// where the account came from at signup. Written once (first page the visitor
// actually opened), never overwritten, so the origin source survives the
// referral path to /auth/signup.
const COOKIE = "cp_src";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function utmFromSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = params.get(key);
    if (v && v.trim()) out[key] = v.trim().slice(0, 200);
  }
  return out;
}

function safeReferrer(): string {
  try {
    const ref = document.referrer || "";
    const url = new URL(ref);
    if (url.hostname === window.location.hostname) return "";
    return ref.slice(0, 500);
  } catch {
    return "";
  }
}

// Rendered once in the root layout. Cheap: reads location/referrer, writes a
// cookie only when it's not already set from an earlier landing.
export default function SignupSourceTracker() {
  useEffect(() => {
    try {
      if (readCookie(COOKIE)) return; // first-touch already captured
      const utm = utmFromSearch(window.location.search);
      const ref = safeReferrer();
      if (Object.keys(utm).length === 0 && !ref) return; // direct bot/empty — nothing useful
      writeCookie(COOKIE, JSON.stringify({ ...utm, ref, landedAt: Date.now() }), MAX_AGE);
    } catch {}
  }, []);
  return null;
}