export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/totp";
import { rateLimitAsync } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { email, token } = await req.json();
  if (!email || !token) return NextResponse.json({ error: "Email and token required" }, { status: 400 });

  const rl = await rateLimitAsync(`2fa:${ip}`, { max: 5, windowMs: 60_000 });
  const rlEmail = await rateLimitAsync(`2fa:${email.toLowerCase()}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok || !rlEmail.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { totpSecret: true } });
  // No 2FA: reject with the same error shape as a bad code, so callers can't
  // tell whether 2FA is enabled for an account.
  if (!user?.totpSecret) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: verifyToken(user.totpSecret, token) });
}
