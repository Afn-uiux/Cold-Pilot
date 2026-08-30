export const runtime = "nodejs";

import { getAuthContext, requireScope } from "@/lib/api-auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext(req);
  const denied = requireScope(ctx, "read");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  const where: any = { userId: ctx!.userId, deletedAt: null };
  if (campaignId) where.campaignId = campaignId;

  const leads = await prisma.lead.findMany({
    where,
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(leads);
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext(req);
  const denied = requireScope(ctx, "write");
  if (denied) return denied;
  const blocked = await trialGuard(ctx!.userId);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all");
  const campaignId = searchParams.get("campaignId");

  if (campaignId) {
    await prisma.lead.updateMany({ where: { campaignId, userId: ctx!.userId, deletedAt: null }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, deleted: "campaign" });
  }

  if (all === "true") {
    await prisma.lead.updateMany({ where: { userId: ctx!.userId, deletedAt: null }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, deleted: "all" });
  }

  if (!id) {
    return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({ where: { id, userId: ctx!.userId, deletedAt: null } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}