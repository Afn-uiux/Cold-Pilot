import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { rateLimit } from "@/lib/rate-limit";

const protectedPaths = ["/dashboard"];
const authPaths = ["/auth/login", "/auth/signup"];
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET!;

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(cookieName)?.value;

  if (sessionCookie) {
    try {
      const token = await decode({ token: sessionCookie, secret, salt: cookieName });
      if (token?.sid) {
        const bindingCookie = request.cookies.get("session-binding")?.value;

        if (!bindingCookie) {
          const res = NextResponse.next();
          res.cookies.set("session-binding", token.sid as string, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
          });
          return res;
        }

        if (bindingCookie !== token.sid) {
          const loginUrl = new URL("/auth/login", request.url);
          const res = NextResponse.redirect(loginUrl);
          res.cookies.delete(cookieName);
          res.cookies.delete("session-binding");
          return res;
        }
      }
    } catch {
      // Invalid token — will be caught by normal auth flow
    }
  }

  // Clean up orphaned binding cookie (e.g. after sign-out)
  if (!sessionCookie && request.cookies.get("session-binding")?.value) {
    const res = NextResponse.next();
    res.cookies.delete("session-binding");
    return res;
  }

  // Rate limit auth pages (login/signup)
  if (authPaths.some((p) => pathname.startsWith(p))) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const result = rateLimit(`auth:${ip}`, { max: 5, windowMs: 60_000 });
    if (!result.ok) {
      return new NextResponse("Too many requests. Try again later.", { status: 429 });
    }
  }

  // Redirect authenticated users away from auth pages
  if (sessionCookie && authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to login
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
