export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRIAL_MS } from "@/lib/trial";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const secret = process.env.AUTH_MIGRATION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Migration endpoint disabled" }, { status: 404 });
  }

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, name, avatar, password } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });

  // Never create accounts or set passwords implicitly. This endpoint only
  // returns the existing user's id for downstream linking. Password setup is
  // the normal signup flow's job.
  if (existing) {
    return NextResponse.json({ id: existing.id, email: existing.email });
  }

  const providedPassword = typeof password === "string" && password.length >= 8 ? password : null;
  if (!providedPassword) {
    return NextResponse.json({ error: "New users require an explicit password" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(providedPassword, 12);
  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword, image: avatar, trialEndsAt: new Date(Date.now() + TRIAL_MS) },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
