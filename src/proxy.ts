import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { currencyFromCountry } from "@/lib/currency";

const protectedPaths = ["/dashboard"];
const authPaths = ["/auth/login", "/auth/signup"];
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET!;

// Build a strict, nonce-based CSP. script-src uses a per-request nonce (plus
// 'strict-dynamic') so only Next.js-approved scripts run — no 'unsafe-inline'
// and, in production, no 'unsafe-eval' (React/Next don't use eval in prod).
// style-src keeps 'unsafe-inline' because the app uses inline style attributes,
// which nonces cannot cover and which are not an executable payload.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const header = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: https:;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https:;
    child-src 'none';
    object-src 'none';
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self'
  `;
  return header.replace(/\s{2,}/g, " ").trim();
}

function applySecurityHeaders(res: NextResponse, csp: string) {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), usb=(), autoplay=(), encrypted-media=(), payment=()");
  res.headers.delete("X-Powered-By");
}

function getCookieName(request: NextRequest): string {
  // Cookie naming must not branch purely on a client-supplied
  // `x-forwarded-proto` header: an attacker could spoof it to make the proxy
  // look for/clear the wrong (__Secure- vs plain) session cookie. Only trust an
  // explicit proxy boundary (production always runs behind a TLS-terminating
  // proxy; dev/self-hosted must set TRUST_PROXY=true before the header is used).
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const trustProxy = process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true";
  if (process.env.NODE_ENV === "production" || (trustProxy && proto === "https")) {
    return "__Secure-authjs.session-token";
  }
  return "authjs.session-token";
}

function clearSessionCookies(res: NextResponse, cookieName: string) {
  res.cookies.delete(cookieName);
  res.cookies.delete("__Secure-authjs.session-token");
  res.cookies.delete("authjs.session-token");
  res.cookies.delete("session-binding");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = buildCsp(nonce);

  // Stamp the visitor's currency (from their country) so client components can
  // render prices in naira (Nigeria) or dollars (everywhere else). Cloudflare
  // proxies inject cf-ipcountry; without it (dev/self-hosted), default to NGN,
  // which matches currencyFromHeaders() used by server-rendered pages.
  const reqCountry = request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country");
  const ccCookie = reqCountry ? currencyFromCountry(reqCountry) : "NGN";
  const applyCcCookie = (res: NextResponse) => {
    if (request.cookies.get("cc")?.value !== ccCookie) {
      res.cookies.set("cc", ccCookie, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, httpOnly: false });
    }
  };

  // Forward the nonce to the app so Next.js applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const { pathname } = request.nextUrl;
  const cookieName = getCookieName(request);
  const sessionCookie = request.cookies.get(cookieName)?.value
    || request.cookies.get("__Secure-authjs.session-token")?.value
    || request.cookies.get("authjs.session-token")?.value;
  const isAuthPath = authPaths.some((p) => pathname.startsWith(p));
  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p));

  // Decode the session cookie, but treat failure as "no session" — NEVER as a
  // reason to redirect. An undecodable cookie combined with a same-URL redirect
  // (/auth/login -> /auth/login) is an infinite loop if the browser refuses the
  // cookie-clearing Set-Cookie (attribute/prefix mismatch), which surfaces as
  // ERR_TOO_MANY_REDIRECTS. Falling through just renders the page; the stale
  // cookie is overwritten on the next successful sign-in.
  let sessionToken: unknown = null;
  if (sessionCookie) {
    try {
      sessionToken = await decode({ token: sessionCookie, secret, salt: cookieName });
      console.log(`[proxy-debug] ${pathname} cookie=${cookieName} decode=${sessionToken ? "ok" : "null"} secretLen=${secret?.length}`);
    } catch {
      sessionToken = null;
    }
  }

  if (isAuthPath) {
    const ip = getClientIp(request.headers);
    const result = rateLimit(`auth:${ip}`, { max: 5, windowMs: 60_000 });
    if (!result.ok) {
      const res = new NextResponse("Too many requests. Try again later.", { status: 429 });
      applySecurityHeaders(res, cspHeader);
      return res;
    }
  }

  // NOTE: do NOT redirect authed users from /auth/login to /dashboard here.
  // The dashboard layout re-validates sessions against the DB (UserSession
  // row), which this edge proxy cannot do — if the JWT decodes but its sid is
  // gone (DB restore, revocation), redirecting to /dashboard only bounces the
  // browser straight back here, producing ERR_TOO_MANY_REDIRECTS. The layout
  // is the single source of truth: a stale cookie just renders the login page
  // and signing in again mints a fresh session.

  if (!sessionToken && isProtectedPath) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(loginUrl);
    clearSessionCookies(res, cookieName);
    applySecurityHeaders(res, cspHeader);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(res, cspHeader);
  applyCcCookie(res);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
