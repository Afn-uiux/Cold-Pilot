import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const leadId = url.searchParams.get("id");

  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: session.user.id },
      include: { campaign: { select: { name: true } } },
    });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const emailLogs = await prisma.emailLog.findMany({
      where: { leadId },
      orderBy: { sentAt: "asc" },
      include: { emailAccount: { select: { email: true } } },
    });

    return NextResponse.json({ lead, emailLogs });
  }

  const [leads, campaigns, emailAccounts] = await Promise.all([
    prisma.lead.findMany({
      where: { userId: session.user.id },
      select: {
        id: true, firstName: true, lastName: true, email: true, status: true,
        campaignId: true, lastReadAt: true,
        campaign: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.campaign.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, email: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const leadIds = leads.map(l => l.id);
  const chunked = <T>(arr: T[], size = 500) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  const [latestLogsChunks, dealsChunks] = await Promise.all([
    leadIds.length > 0
      ? Promise.all(chunked(leadIds).map(chunk =>
          prisma.emailLog.findMany({
            where: { leadId: { in: chunk } },
            orderBy: { sentAt: "desc" },
            include: { emailAccount: { select: { id: true, email: true } } },
          })
        ))
      : [],
    leadIds.length > 0
      ? Promise.all(chunked(leadIds).map(chunk =>
          prisma.deal.findMany({
            where: { leadId: { in: chunk } },
            select: { leadId: true, stage: true, status: true, value: true },
          })
        ))
      : [],
  ]);
  const latestLogs = latestLogsChunks.flat();
  const deals = dealsChunks.flat();

  const latestByLead = new Map<string, typeof latestLogs[0]>();
  for (const log of latestLogs) {
    if (!latestByLead.has(log.leadId)) {
      latestByLead.set(log.leadId, log);
    }
  }

  const dealByLead = new Map<string, typeof deals[0]>();
  for (const d of deals) {
    if (d.leadId) dealByLead.set(d.leadId, d);
  }

  const threads = leads
    .filter(l => latestByLead.has(l.id))
    .map(l => {
    const lastLog = latestByLead.get(l.id)!;
    const deal = dealByLead.get(l.id);
    const isReplied = l.status === "replied";
    const lastLogTime = new Date(lastLog.sentAt).getTime();
    const readAt = l.lastReadAt ? new Date(l.lastReadAt).getTime() : 0;
    const unread = isReplied && readAt < lastLogTime;
    return {
      id: l.id,
      name: [l.firstName, l.lastName].filter(Boolean).join(" ") || l.email,
      email: l.email,
      campaignId: l.campaignId,
      campaignName: l.campaign?.name || null,
      emailAccountId: lastLog.emailAccountId,
      emailAccountEmail: lastLog.emailAccount?.email || null,
      subject: lastLog.subject || "No subject",
      preview: lastLog.bodyHtml ? lastLog.bodyHtml.replace(/<[^>]*>/g, "").slice(0, 120) : "",
      time: timeAgo(lastLog.sentAt),
      unread,
      repliedAt: isReplied ? lastLog.repliedAt : null,
      dealStage: deal?.stage || null,
      dealStatus: deal?.status || null,
      dealValue: deal?.value || 0,
    };
  });

  return NextResponse.json({ threads, campaigns, emailAccounts });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: session.user.id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lead.update({ where: { id: leadId }, data: { lastReadAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: session.user.id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.emailLog.deleteMany({ where: { leadId } });
  await prisma.deal.deleteMany({ where: { leadId } });
  await prisma.lead.delete({ where: { id: leadId } });
  return NextResponse.json({ ok: true });
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
