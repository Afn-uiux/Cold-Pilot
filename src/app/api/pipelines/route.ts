export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pipelines = await prisma.pipeline.findMany({ where: { userId: session.user.id }, include: { _count: { select: { deals: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json(pipelines);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, stages } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const pipeline = await prisma.pipeline.create({ data: { userId: session.user.id, name, stages: stages || JSON.stringify(["qualified", "demo", "negotiation", "won", "lost"]) } });
  return NextResponse.json(pipeline);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, name, stages } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const p = await prisma.pipeline.findFirst({ where: { id, userId: session.user.id } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data: Record<string, any> = {};
  if (name) data.name = name;
  if (stages) data.stages = stages;
  await prisma.pipeline.update({ where: { id }, data });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const p = await prisma.pipeline.findFirst({ where: { id, userId: session.user.id } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.pipeline.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
