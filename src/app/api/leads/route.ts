export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  const where: any = { userId: session.user.id, deletedAt: null };
  if (campaignId) where.campaignId = campaignId;

  const leads = await prisma.lead.findMany({
    where,
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(leads);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all");
  const campaignId = searchParams.get("campaignId");

  if (campaignId) {
    await prisma.lead.updateMany({ where: { campaignId, userId: session.user.id, deletedAt: null }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, deleted: "campaign" });
  }

  if (all === "true") {
    await prisma.lead.updateMany({ where: { userId: session.user.id, deletedAt: null }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, deleted: "all" });
  }

  if (!id) {
    return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({ where: { id, userId: session.user.id, deletedAt: null } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
