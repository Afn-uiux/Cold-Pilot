export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, scopes: true, lastUsedAt: true, createdAt: true, key: false },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, scopes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const key = `cp_${crypto.randomBytes(24).toString("hex")}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      key,
      scopes: scopes || "read",
    },
  });

  return NextResponse.json({ id: apiKey.id, name: apiKey.name, key, scopes: apiKey.scopes, createdAt: apiKey.createdAt });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const key = await prisma.apiKey.findFirst({ where: { id, userId: session.user.id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKey.delete({ where: { id } });
  return NextResponse.json({ success: true });
}