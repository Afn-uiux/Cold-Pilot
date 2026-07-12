import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const c = await prisma.campaign.findFirst({
      where: { id, userId: session.user.id },
      include: {
        steps: { orderBy: { order: "asc" } },
        schedules: { orderBy: { order: "asc" } },
        _count: { select: { leads: true } },
      },
    });
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(c);
  }
  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { leads: true, steps: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with email metrics per campaign
  const enriched = await Promise.all(campaigns.map(async (c) => {
    const totalLeads = c._count.leads;
    const sentCount = await prisma.emailLog.count({
      where: { lead: { campaignId: c.id }, type: "outgoing", status: "sent" },
    });
    const clickCount = await prisma.emailLog.count({
      where: { lead: { campaignId: c.id }, type: "outgoing", clickedAt: { not: null } },
    });
    const repliedCount = await prisma.emailLog.count({
      where: { lead: { campaignId: c.id }, type: "incoming" },
    });
    const repliedLeads = await prisma.lead.count({
      where: { campaignId: c.id, status: "replied" },
    });
    const completedLeads = await prisma.lead.count({
      where: { campaignId: c.id, status: "completed" },
    });
    // Count deals whose leadId belongs to this campaign
    const campaignLeadIds = (await prisma.lead.findMany({
      where: { campaignId: c.id },
      select: { id: true },
    })).map(l => l.id);
    const opportunities = campaignLeadIds.length > 0
      ? await prisma.deal.count({ where: { leadId: { in: campaignLeadIds } } })
      : 0;
    return {
      ...c,
      metrics: {
        sentCount,
        clickCount,
        repliedCount,
        repliedLeads,
        opportunities,
        totalLeads,
        completedLeads,
        progress: totalLeads > 0 ? Math.min(Math.round((sentCount / (totalLeads * Math.max(c._count.steps, 1))) * 100), 100) : 0,
        replyRate: sentCount > 0 ? Math.round((repliedLeads / sentCount) * 100) : 0,
      },
    };
  }));

  return NextResponse.json(enriched);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const body = await req.json();
  const c = await prisma.campaign.findFirst({ where: { id, userId: session.user.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.steps) {
    await prisma.campaignStep.deleteMany({ where: { campaignId: id } });
    for (let i = 0; i < body.steps.length; i++) {
      const s = body.steps[i]; await prisma.campaignStep.create({ data: { order: i, type: "email", subject: s.subject || null, bodyHtml: s.bodyHtml || null, delayDays: s.delayDays ?? 0, delayUnit: s.delayUnit || "days", campaignId: id } });
    }
    return NextResponse.json({ success: true });
  }
  const allKeys = [...new Set([
    ...Object.keys(body),
  ])];

  // Combined settings save — collect all known campaign fields
  const campaignFields = ["status","accountIds","openTracking","clickTracking","dailySendLimit","slowRamp","rampStart","stopOnReply","plainTextOnly","firstEmailPlainText","crmOwner","customTags","minTimeBetween","randomExtraTime","maxNewLeads","prioritizeNewLeads","autoOptimizeAB","abWinningMetric","providerMatching","espRouting","stopOnCompanyReply","stopOnAutoReply","unsubscribeHeader","enableRiskyEmails","disableBounceProtect","ccAddresses","bccAddresses","startDate","endDate","noEndDate"];
  const campaignData: any = {};
  for (const key of campaignFields) {
    if (body[key] !== undefined) {
      if (key === "rampStart" || key === "startDate" || key === "endDate") {
        campaignData[key] = body[key] ? new Date(body[key]) : null;
      } else {
        campaignData[key] = body[key];
      }
    }
  }
  if (Object.keys(campaignData).length > 0) {
    await prisma.campaign.update({ where: { id }, data: campaignData });
  }

  // Handle schedules upsert/delete
  if (body.schedules !== undefined) {
    const schedules = body.schedules as { id?: string; name: string; startTime: string; endTime: string; timezone?: string; days: string; order: number }[];
    const existingIds = new Set((await prisma.campaignSchedule.findMany({ where: { campaignId: id }, select: { id: true } })).map(s => s.id));
    const incomingIds = new Set(schedules.filter(s => s.id).map(s => s.id!));
    const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
    if (toDelete.length > 0) await prisma.campaignSchedule.deleteMany({ where: { id: { in: toDelete } } });
    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      if (s.id && existingIds.has(s.id)) {
        await prisma.campaignSchedule.update({ where: { id: s.id }, data: { name: s.name, startTime: s.startTime, endTime: s.endTime, timezone: s.timezone || "America/New_York", days: s.days, order: i } });
      } else {
        await prisma.campaignSchedule.create({ data: { campaignId: id, name: s.name, startTime: s.startTime, endTime: s.endTime, timezone: s.timezone || "America/New_York", days: s.days, order: i } });
      }
    }
    return NextResponse.json({ success: true });
  }

  // Catch-all: if campaignData was saved above but no schedules block, still return success
  if (Object.keys(campaignData).length > 0) return NextResponse.json({ success: true });

  return NextResponse.json({ error: "No action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, steps } = await req.json();
  if (!name || !steps?.length) return NextResponse.json({ error: "Name and steps required" }, { status: 400 });
  const campaign = await prisma.campaign.create({
    data: { name, userId: session.user.id, status: "draft", steps: { create: steps.map((s: any, i: number) => ({ order: i, type: s.type || "email", subject: s.subject || null, bodyHtml: s.body || null, delayDays: s.delayDays ?? 0 })) } },
    include: { steps: true },
  });
  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const c = await prisma.campaign.findFirst({ where: { id, userId: session.user.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}