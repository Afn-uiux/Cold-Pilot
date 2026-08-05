export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suppressions = await prisma.suppression.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(suppressions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, reason, type } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const existing = await prisma.suppression.findUnique({
    where: { userId_email: { userId: session.user.id, email: email.toLowerCase().trim() } },
  });
  if (existing) return NextResponse.json({ error: "Already suppressed" }, { status: 409 });

  const suppression = await prisma.suppression.create({
    data: {
      userId: session.user.id,
      email: email.toLowerCase().trim(),
      reason: reason || "Manual",
      type: type || "manual",
    },
  });

  return NextResponse.json(suppression);
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

  const s = await prisma.suppression.findFirst({ where: { id, userId: session.user.id } });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.suppression.delete({ where: { id } });
  return NextResponse.json({ success: true });
}