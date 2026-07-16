export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { generateSecret, verifyToken } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();

  // If token provided, verify and enable
  if (token) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { totpSecret: true } });
    if (!user?.totpSecret) return NextResponse.json({ error: "2FA not set up yet" }, { status: 400 });
    if (!verifyToken(user.totpSecret, token)) return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    return NextResponse.json({ enabled: true });
  }

  // Generate new secret
  const { secret, base32 } = generateSecret();

  await prisma.user.update({ where: { id: session.user.id }, data: { totpSecret: secret } });

  const keyuri = `otpauth://totp/Coldpilot:${session.user.email}?secret=${base32}&issuer=Coldpilot`;

  return NextResponse.json({ secret: base32, keyuri });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({ where: { id: session.user.id }, data: { totpSecret: null } });

  return NextResponse.json({ success: true });
}
