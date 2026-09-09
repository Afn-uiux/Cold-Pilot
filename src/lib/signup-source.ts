import { cookies } from "next/headers";

export const SIGNUP_SOURCE_COOKIE = "cp_src";

export type SignupSourceData = {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landedAt?: number;
};

// Client writes cp_src (JSON) on first landing; both the email-signup server
// action (via cookies()) and the verify route (via Cookie header) read it to
// record where an account came from. Never trust the client shape — bounded
// strings only, so a hostile cookie can't blob arbitrary data into the row.
export function parseSignupSourceCookie(raw: string | null | undefined): SignupSourceData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const out: SignupSourceData = {};
    for (const key of ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const) {
      const v = parsed[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 500);
    }
    const landedAt = parsed.landedAt;
    if (typeof landedAt === "number" && Number.isFinite(landedAt)) out.landedAt = landedAt;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function readableSource(raw: string | null | undefined): string {
  const src = parseSignupSourceCookie(raw);
  if (!src) return "";
  // Prefer an explicit UTM source; a bare cross-site referrer is the fallback.
  const source = src.utm_source || src.ref || "";
  try {
    return source.startsWith("http")
      ? new URL(source).hostname.replace(/^www\./, "")
      : source;
  } catch {
    return source;
  }
}

// Country of origin from the edge headers Cloudflare/Vercel inject. Same
// source already used for billing-currency selection; separate function so the
// semantic ("where did this signup come from") is explicit and reusable.
export function countryFromHeaders(h: Headers): string | null {
  const country = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country");
  return country && /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : null;
}

// Raw User-Agent header, bounded so a hostile one can't bloat the row.
export function userAgentFromHeaders(h: Headers): string | null {
  const ua = h.get("user-agent");
  return ua && ua.trim() ? ua.trim().slice(0, 500) : null;
}

// Async variant for server actions / route handlers that already have headers.
export async function readSignupSourceFromRequest(): Promise<SignupSourceData | null> {
  try {
    const c = await cookies();
    const raw = c.get(SIGNUP_SOURCE_COOKIE)?.value ?? null;
    return parseSignupSourceCookie(raw);
  } catch {
    return null;
  }
}