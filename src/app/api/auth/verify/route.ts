export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmailSafe } from "@/lib/email/send";
import { VERIFY_TOKEN_TTL_MS } from "@/lib/verification";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";
import { hashToken } from "@/lib/tokens";

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
    select: { emailVerified: true },
  });

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token: tokenDigest } });

  if (!before?.emailVerified) {
    sendEmailSafe(record.identifier, "welcome");
  }

  return NextResponse.json({ message: "Email verified successfully" });
}
