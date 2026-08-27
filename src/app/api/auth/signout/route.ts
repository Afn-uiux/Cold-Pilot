export const runtime = "nodejs";

import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { revokeSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

function baseUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

function clearSessionCookies(res: NextResponse): void {
  const clear = (name: string, opts: Record<string, any> = {}) =>
    res.cookies.set(name, "", { maxAge: 0, path: "/", sameSite: "lax", ...opts });

  // Non-secure variants (dev HTTP)
  clear("authjs.session-token");
  clear("authjs.csrf-token");
  clear("authjs.callback-url");

  // Secure variants (HTTPS / production)
  clear("__Secure-authjs.session-token", { secure: true });
  clear("__Secure-authjs.csrf-token", { secure: true });
  clear("__Secure-authjs.callback-url", { secure: true });
}

async function revokeCurrentSession(): Promise<void> {
  const session = await auth();
  if (session) {
    // Revoke the server-side session record so the JWT stops being accepted
    // immediately, everywhere — not just in the browser that signed out.
    await revokeSession(session.sid);
  }
}

// Used by the dashboard sidebar link (plain GET navigation).
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (session?.sid) {
    await revokeSession(session.sid).catch(() => {});
  }

  const res = NextResponse.redirect(new URL("/auth/login", baseUrl(req)));
  clearSessionCookies(res);
  return res;
}

// Used by next-auth/react signOut({ redirect: false }) — the client POSTs with
// a csrfToken and expects a JSON response. Mirrors Auth.js's double-submit
// CSRF check (cookie value is `token|sha256(token + secret)`).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const bodyCsrf = String(formData.get("csrfToken") ?? "");

  const csrfCookie = req.cookies.get("authjs.csrf-token")?.value ?? "";
  const [token, hash] = csrfCookie.split("|");
  const expectedHash = createHash("sha256")
    .update(`${token}${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex");
  if (!token || hash !== expectedHash || token !== bodyCsrf) {
    return NextResponse.json({ error: "CSRF token mismatch" }, { status: 403 });
  }

  await revokeCurrentSession();

  const res = NextResponse.json({ url: "/auth/login" });
  clearSessionCookies(res);
  return res;
}
