export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { logLoginAttempt } from "@/lib/login-audit";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const code = (formData.get("code") as string) || undefined;

    const ip = getClientIp(req.headers as unknown as { get(name: string): string | null });
    const ua = req.headers.get("user-agent");
    const emailKey = (email || "").trim().toLowerCase();

    if (!email || !password) {
      await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: false, reason: "missing" });
      return NextResponse.redirect(new URL("/auth/login?error=missing", getBaseUrl(req)));
    }

    // Brute-force / password-spray protection. The page-level limiter in
    // proxy.ts does NOT cover /api, so throttle here — per source IP AND per
    // targeted email — using the shared (Redis-backed) limiter so the limit
    // holds across instances. Keyed on a trusted client IP (see getClientIp).
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimitAsync(`login:ip:${ip}`, { max: 10, windowMs: 60_000 }),
      rateLimitAsync(`login:email:${emailKey}`, { max: 5, windowMs: 60_000 }),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: false, reason: "throttled" });
      return NextResponse.redirect(new URL("/auth/login?error=rate_limited", getBaseUrl(req)));
    }

    const result = await signIn("credentials", {
      email,
      password,
      ...(code ? { code } : {}),
      redirect: false,
    });

    if (result?.error) {
      await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: false, reason: "invalid" });
      return NextResponse.redirect(new URL("/auth/login?error=invalid", getBaseUrl(req)));
    }

    await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: true, reason: "success" });
    return NextResponse.redirect(new URL("/dashboard", getBaseUrl(req)));
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=failed", getBaseUrl(req)));
  }
}

// Redirect to the host the request actually arrived on (accounts for the
// Cloudflare tunnel) instead of always using the server's localhost origin.
function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
