export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

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

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(BYPASS_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
  });
  return res;
}
