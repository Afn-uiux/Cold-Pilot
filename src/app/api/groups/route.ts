export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.group.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const group = await prisma.group.create({
    data: { name: name.trim(), userId: session.user.id },
  });

  return NextResponse.json(group);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, leadIds } = await req.json();
  const group = await prisma.group.findFirst({ where: { id, userId: session.user.id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (name) await prisma.group.update({ where: { id }, data: { name } });

  if (leadIds) {
    await prisma.leadGroup.deleteMany({ where: { groupId: id } });
    if (leadIds.length > 0) {
      await prisma.leadGroup.createMany({
        data: leadIds.map((leadId: string) => ({ leadId, groupId: id })),
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const group = await prisma.group.findFirst({ where: { id, userId: session.user.id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
