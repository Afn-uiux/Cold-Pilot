import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { rateLimit } from "@/lib/rate-limit";

const protectedPaths = ["/dashboard"];
const authPaths = ["/auth/login", "/auth/signup"];
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET!;

function getCookieName(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (proto === "https" || process.env.NODE_ENV === "production") {
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
  const { pathname } = request.nextUrl;
  const cookieName = getCookieName(request);
  const sessionCookie = request.cookies.get(cookieName)?.value
    || request.cookies.get("__Secure-authjs.session-token")?.value
    || request.cookies.get("authjs.session-token")?.value;

  if (sessionCookie) {
    try {
      const token = await decode({ token: sessionCookie, secret, salt: cookieName });
      if (!token) {
        const loginUrl = new URL("/auth/login", request.url);
        const res = NextResponse.redirect(loginUrl);
        clearSessionCookies(res, cookieName);
        return res;
      }
    } catch {
      const loginUrl = new URL("/auth/login", request.url);
      const res = NextResponse.redirect(loginUrl);
      clearSessionCookies(res, cookieName);
      return res;
    }
  }

  if (authPaths.some((p) => pathname.startsWith(p))) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const result = rateLimit(`auth:${ip}`, { max: 5, windowMs: 60_000 });
    if (!result.ok) {
      return new NextResponse("Too many requests. Try again later.", { status: 429 });
    }
  }

  if (sessionCookie && authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!sessionCookie && protectedPaths.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
