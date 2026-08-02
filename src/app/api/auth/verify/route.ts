export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmailSafe } from "@/lib/email/send";
import crypto from "crypto";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    // Same response whether or not the account exists — avoids account enumeration.
    return NextResponse.json({ message: "If an unverified account exists, a verification email was sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
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

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (new Date() > record.expires) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ message: "Email verified successfully" });
}
