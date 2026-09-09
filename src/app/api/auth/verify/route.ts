export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmailSafe } from "@/lib/email/send";
import { VERIFY_TOKEN_TTL_MS } from "@/lib/verification";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";
import { hashToken } from "@/lib/tokens";
import { parseSignupSourceCookie, parseCookieHeader, countryFromHeaders, userAgentFromHeaders } from "@/lib/signup-source";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Throttle verification resends — per source IP AND per targeted email,
  // mirroring the password-reset request route. Without this an attacker
  // could repeatedly trigger verification emails as a spam/abuse vector.
  const ip = getClientIp(req.headers as unknown as { get(name: string): string | null });
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimitAsync(`verify-resend:ip:${ip}`, { max: 5, windowMs: 60_000 }),
    rateLimitAsync(`verify-resend:email:${email.toLowerCase()}`, { max: 3, windowMs: 60_000 }),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    // Same response whether or not the account exists — avoids account enumeration.
    return NextResponse.json({ message: "If an unverified account exists, a verification email was sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  // Only the digest is stored — a leaked DB never exposes usable tokens.
  await prisma.verificationToken.create({
    data: { identifier: email, token: hashToken(token), expires },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/auth/verify?token=${token}`;
  sendEmailSafe(email, "email-verification", { verifyUrl });

  return NextResponse.json({ message: "If an unverified account exists, a verification email was sent." });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const tokenDigest = hashToken(token);
  const record = await prisma.verificationToken.findUnique({ where: { token: tokenDigest } });
  if (!record) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (new Date() > record.expires) {
    await prisma.verificationToken.delete({ where: { token: tokenDigest } });
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  // Welcome email only goes out once the link is actually clicked and verified
  // — never at signup. Read the pre-verify state so the welcome is sent exactly
  // once, only when this is the click that flips emailVerified from null.
  const before = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { emailVerified: true, signupIp: true, signupCountry: true, signupSource: true, signupUserAgent: true },
  });

  const data: {
    emailVerified: Date;
    signupIp?: string | null;
    signupCountry?: string | null;
    signupSource?: string | null;
    signupReferrer?: string | null;
    signupUtmSource?: string | null;
    signupUtmMedium?: string | null;
    signupUtmCampaign?: string | null;
    signupUserAgent?: string | null;
  } = { emailVerified: new Date() };

  // Google signups can't reach request headers in the signIn callback, so the
  // first verification click is the one place we can attribute the account.
  // Only backfill what's missing — fields already captured at email signup are
  // kept untouched.
  const ip = getClientIp(req.headers as unknown as { get(name: string): string | null });
  if (!before?.signupIp && ip && ip !== "unknown") data.signupIp = ip;
  const country = countryFromHeaders(req.headers as unknown as Headers);
  if (!before?.signupCountry && country) data.signupCountry = country;
  const ua = userAgentFromHeaders(req.headers as unknown as Headers);
  if (!before?.signupUserAgent && ua) data.signupUserAgent = ua;
  if (!before?.signupSource) {
    const src = parseSignupSourceCookie(
      parseCookieHeader((req.headers as unknown as Headers).get("cookie"))?.cp_src,
    );
    if (src) {
      if (!before?.signupSource && (src.utm_source || src.ref)) data.signupSource = src.utm_source || src.ref;
      if (src.ref) data.signupReferrer = src.ref;
      if (src.utm_source) data.signupUtmSource = src.utm_source;
      if (src.utm_medium) data.signupUtmMedium = src.utm_medium;
      if (src.utm_campaign) data.signupUtmCampaign = src.utm_campaign;
    }
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data,
  });
  await prisma.verificationToken.delete({ where: { token: tokenDigest } });

  if (!before?.emailVerified) {
    sendEmailSafe(record.identifier, "welcome");
  }

  return NextResponse.json({ message: "Email verified successfully" });
}
