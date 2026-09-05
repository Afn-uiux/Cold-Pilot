export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generateSecret, verifyToken } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, currentPassword } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true, totpSecret: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Every mutation here that changes or removes the 2FA secret must prove the
  // current password (re-auth) AND a valid OTP. This stops a session thief
  // from silently stripping or rotating the victim's 2FA.
  const passwordOk = !!(user.password && currentPassword && (await bcrypt.compare(String(currentPassword), user.password)));

  // Enable with an existing secret: require confirmation code.
  if (token) {
    if (!user.totpSecret) return NextResponse.json({ error: "2FA not set up yet" }, { status: 400 });
    if (!verifyToken(user.totpSecret, token)) return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    return NextResponse.json({ enabled: true });
  }

  // Rotate/regenerate secret: require password + code for the current secret.
  const rotateCode = typeof token === "string" ? token : "";

  if (user.totpSecret) {
    if (!passwordOk) return NextResponse.json({ error: "Current password required" }, { status: 403 });
    if (!user.totpSecret || !verifyToken(user.totpSecret, rotateCode)) {
      return NextResponse.json({ error: "Invalid current 2FA code" }, { status: 400 });
    }
  } else {
    // Initial enrollment: also require the current password. Without this, a
    // session thief (stolen cookie, unattended laptop) could generate a secret
    // into their own authenticator app, confirm it, and lock the real owner
    // out behind attacker-controlled 2FA. OAuth-only accounts have no
    // password — for them the verified provider session is the auth.
    if (user.password && !passwordOk) {
      return NextResponse.json({ error: "Current password required" }, { status: 403 });
    }
  }

  // Generate new secret
  const { secret, base32 } = generateSecret();

  await prisma.user.update({ where: { id: session.user.id }, data: { totpSecret: secret } });

  const keyuri = `otpauth://totp/Coldpilot:${session.user.email}?secret=${base32}&issuer=Coldpilot`;

  return NextResponse.json({ secret: base32, keyuri });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, token } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true, totpSecret: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.totpSecret) return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });

  const passwordOk = !!(user.password && currentPassword && (await bcrypt.compare(String(currentPassword), user.password)));
  if (!passwordOk) return NextResponse.json({ error: "Current password required" }, { status: 403 });
  if (!verifyToken(user.totpSecret, typeof token === "string" ? token : "")) {
    return NextResponse.json({ error: "Invalid 2FA code" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { totpSecret: null } });

  return NextResponse.json({ success: true });
}
