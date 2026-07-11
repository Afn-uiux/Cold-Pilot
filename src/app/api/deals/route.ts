import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  const where: any = { userId: session.user.id };
  if (pipelineId) where.pipelineId = pipelineId;
  const deals = await prisma.deal.findMany({
    where,
    include: { pipeline: { select: { name: true } }, _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pipelineId, name, value, stage, leadId } = await req.json();
  if (!pipelineId || !name) return NextResponse.json({ error: "Pipeline and name required" }, { status: 400 });
  const deal = await prisma.deal.create({ data: { userId: session.user.id, pipelineId, leadId: leadId || null, name, value: value || 0, stage: stage || "qualified" } });
  return NextResponse.json(deal);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, stage, value, status, notes } = await req.json();
  const deal = await prisma.deal.findFirst({ where: { id, userId: session.user.id } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.deal.update({ where: { id }, data: { ...(stage ? { stage } : {}), ...(value !== undefined ? { value } : {}), ...(status ? { status } : {}), ...(notes !== undefined ? { notes } : {}) } });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const deal = await prisma.deal.findFirst({ where: { id, userId: session.user.id } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
