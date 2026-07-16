export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${host}`;

  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", baseUrl));
  }

  // Clear the session cookie manually
  const res = NextResponse.redirect(new URL("/auth/login", baseUrl));
  res.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/" });
  res.cookies.set("authjs.csrf-token", "", { maxAge: 0, path: "/" });
  res.cookies.set("authjs.callback-url", "", { maxAge: 0, path: "/" });
  // Also clear the secure variants
  res.cookies.set("__Secure-authjs.session-token", "", { maxAge: 0, path: "/" });
  res.cookies.set("__Secure-authjs.callback-url", "", { maxAge: 0, path: "/" });
  return res;
}
