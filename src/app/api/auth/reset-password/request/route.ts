export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmailSafe } from "@/lib/email/send";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

// Identifier prefix keeps reset tokens in the same VerificationToken table
// without colliding with email-verification tokens for the same address.
const IDENTIFIER_PREFIX = "reset_password:";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const ip = getClientIp(req.headers as unknown as { get(name: string): string | null });
  const rl = await rateLimitAsync(`reset-request:${ip}`, { max: 5, windowMs: 60_000 });
  const rlEmail = await rateLimitAsync(`reset-request:${email.toLowerCase()}`, { max: 3, windowMs: 60_000 });
  if (!rl.ok || !rlEmail.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // Same response whether or not the account exists — avoids account
  // enumeration via this endpoint.
  const genericResponse = NextResponse.json({
    message: "If an account exists for that email, a password reset link was sent.",
  });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return genericResponse;

  const identifier = `${IDENTIFIER_PREFIX}${email}`;
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  // Invalidate any previously issued reset tokens for this address before
  // creating the new one, so only the most recently requested link works.
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires } });

  const resetUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;
  sendEmailSafe(email, "password-reset", { resetUrl });

  return genericResponse;
}
