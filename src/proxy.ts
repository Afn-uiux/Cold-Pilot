import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    connect-src 'self' https:;
    child-src 'none';
    object-src 'none';
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self'
  `;
  return header.replace(/\s{2,}/g, " ").trim();
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

  if (sessionCookie) {
    try {
      const token = await decode({ token: sessionCookie, secret, salt: cookieName });
      if (!token) {
        const loginUrl = new URL("/auth/login", request.url);
        const res = NextResponse.redirect(loginUrl);
        clearSessionCookies(res, cookieName);
        res.headers.set("Content-Security-Policy", cspHeader);
        return res;
      }
    } catch {
      const loginUrl = new URL("/auth/login", request.url);
      const res = NextResponse.redirect(loginUrl);
      clearSessionCookies(res, cookieName);
      res.headers.set("Content-Security-Policy", cspHeader);
      return res;
    }
  }

  if (isAuthPath) {
    const ip = getClientIp(request.headers);
    const result = rateLimit(`auth:${ip}`, { max: 5, windowMs: 60_000 });
    if (!result.ok) {
      const res = new NextResponse("Too many requests. Try again later.", { status: 429 });
      res.headers.set("Content-Security-Policy", cspHeader);
      return res;
    }
  }

  if (sessionCookie && isAuthPath) {
    const res = NextResponse.redirect(new URL("/dashboard", request.url));
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  }

  if (!sessionCookie && isProtectedPath) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", cspHeader);
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
