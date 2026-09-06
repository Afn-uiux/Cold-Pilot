export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync } from "@/lib/rate-limit";

// Operator bypass for waitlist mode. Visit
//   /api/waitlist/bypass?token=<WAITLIST_BYPASS_TOKEN>
// once per browser to get the bypass cookie, then /auth/* and /dashboard work
// normally for you while everyone else still sees the waitlist.
//
// The token is only useful to someone who already knows it (it's never shown
// in the UI), so a GET link is safe here: an attacker can't forge what they
// can't guess.
export const BYPASS_COOKIE = "wp_bypass";

export async function GET(req: NextRequest) {
  const secret = process.env.WAITLIST_BYPASS_TOKEN;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  // Brute-force hygiene on the only secret-guessing vector here.
  const rl = await rateLimitAsync(`bypass:${req.headers.get("x-forwarded-for") || "ip"}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Constant-time compare: plain !== leaks prefix info byte-by-byte.
  const a = Buffer.from(token);
  const b = Buffer.from(secret || "");
  const match = a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  if (!secret || !match) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const res = NextResponse.redirect(
    new URL("/dashboard", process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || req.url)
  );
  res.cookies.set(BYPASS_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
  });
  return res;
}
