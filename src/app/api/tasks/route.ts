export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tasks = await prisma.task.findMany({ where: { userId: session.user.id }, include: { deal: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { title, dealId, dueDate } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (dealId) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: session.user.id }, select: { id: true } });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  const task = await prisma.task.create({ data: { userId: session.user.id, title, dealId: dealId || null, dueDate: dueDate ? new Date(dueDate) : null } });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, done, title } = await req.json();
  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.task.update({ where: { id }, data: { ...(done !== undefined ? { done } : {}), ...(title ? { title } : {}) } });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
