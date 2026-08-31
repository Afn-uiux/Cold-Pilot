export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const code = (formData.get("code") as string) || undefined;

    if (!email || !password) {
      return NextResponse.redirect(new URL("/auth/login?error=missing", req.url));
    }

    // Brute-force / password-spray protection. The page-level limiter in
    // proxy.ts does NOT cover /api, so throttle here — per source IP AND per
    // targeted email — using the shared (Redis-backed) limiter so the limit
    // holds across instances. Keyed on a trusted client IP (see getClientIp).
    const ip = getClientIp(req.headers as unknown as { get(name: string): string | null });
    const emailKey = email.trim().toLowerCase();
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimitAsync(`login:ip:${ip}`, { max: 10, windowMs: 60_000 }),
      rateLimitAsync(`login:email:${emailKey}`, { max: 5, windowMs: 60_000 }),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      return NextResponse.redirect(new URL("/auth/login?error=throttled", req.url));
    }

    const result = await signIn("credentials", {
      email,
      password,
      ...(code ? { code } : {}),
      redirect: false,
    });

    if (result?.error) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid", req.url));
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=failed", req.url));
  }
}
