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
  const groupId = searchParams.get("groupId");

  const where: any = { userId: session.user.id };
  if (campaignId) where.campaignId = campaignId;
  if (groupId) where.groups = { some: { groupId } };

  const leads = await prisma.lead.findMany({
    where,
    include: { campaign: { select: { name: true } }, groups: { include: { group: { select: { name: true } } } } },
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
    await prisma.leadGroup.deleteMany({ where: { lead: { campaignId } } });
    await prisma.emailLog.deleteMany({ where: { lead: { campaignId } } });
    await prisma.lead.deleteMany({ where: { campaignId, userId: session.user.id } });
    return NextResponse.json({ success: true, deleted: "campaign" });
  }

  if (all === "true") {
    await prisma.lead.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ success: true, deleted: "all" });
  }

  if (!id) {
    return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({ where: { id, userId: session.user.id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete related records first to avoid FK constraint issues
  await prisma.emailLog.deleteMany({ where: { leadId: id } });
  await prisma.leadGroup.deleteMany({ where: { leadId: id } });

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
