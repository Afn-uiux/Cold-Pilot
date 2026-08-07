import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { rateLimit } from "@/lib/rate-limit";
import { isSessionValid } from "@/lib/session";

const protectedPaths = ["/dashboard"];
const authPaths = ["/auth/login", "/auth/signup"];
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET!;

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

function clearSessionCookies(res: NextResponse) {
  res.cookies.delete(cookieName);
  // Legacy cookie from the old client-side binding scheme — harmless to
  // clear if a returning browser still has it.
  res.cookies.delete("session-binding");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(cookieName)?.value;

  if (sessionCookie) {
    try {
      const token = await decode({ token: sessionCookie, secret, salt: cookieName });

      // A token without a sid predates this scheme, or is malformed — treat
      // it as signed out rather than trusting it implicitly.
      const valid = token?.sid ? await isSessionValid(token.sid as string) : false;

      if (!valid) {
        const loginUrl = new URL("/auth/login", request.url);
        const res = NextResponse.redirect(loginUrl);
        clearSessionCookies(res);
        return res;
      }
    } catch {
      const loginUrl = new URL("/auth/login", request.url);
      const res = NextResponse.redirect(loginUrl);
      clearSessionCookies(res);
      return res;
    }
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
