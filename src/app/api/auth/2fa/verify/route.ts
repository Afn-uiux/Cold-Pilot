import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const { email, token } = await req.json();
  if (!email || !token) return NextResponse.json({ error: "Email and token required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { totpSecret: true } });
  if (!user?.totpSecret) return NextResponse.json({ valid: true }); // 2FA not enabled

  return NextResponse.json({ valid: verifyToken(user.totpSecret, token) });
}
