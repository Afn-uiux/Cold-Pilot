export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmailSafe } from "@/lib/email/send";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const IDENTIFIER_PREFIX = "reset_password:";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
  }
  if (password.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  }

  const ip = getClientIp(req.headers as unknown as { get(name: string): string | null });
  const rl = await rateLimitAsync(`reset-confirm:${ip}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  if (new Date() > record.expires) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const email = record.identifier.slice(IDENTIFIER_PREFIX.length);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

  // The token is single-use; delete it immediately so it can't be replayed.
  await prisma.verificationToken.delete({ where: { token } });

  // A password reset should also kill any existing sessions — otherwise
  // someone who already had a foothold on the account (e.g. a stolen
  // session) keeps it even after the legitimate owner locks them out.
  await prisma.userSession.deleteMany({ where: { userId: user.id } });

  sendEmailSafe(email, "password-changed");

  return NextResponse.json({ message: "Password reset successfully" });
}
