export const runtime = "nodejs";

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
      where: { id: leadId, userId: session.user.id, deletedAt: null },
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
      where: { userId: session.user.id, status: "replied", deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, email: true, status: true,
        campaignId: true, lastReadAt: true,
        campaign: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.campaign.findMany({
      where: { userId: session.user.id, deletedAt: null },
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
  const [allLogsChunks, dealsChunks] = await Promise.all([
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
  const allLogs = allLogsChunks.flat();
  const deals = dealsChunks.flat();

  const incomingByLead = new Map<string, typeof allLogs[0]>();
  for (const log of allLogs) {
    if (log.type === "incoming" && !incomingByLead.has(log.leadId)) {
      incomingByLead.set(log.leadId, log);
    }
  }

  const outgoingByLead = new Map<string, typeof allLogs[0]>();
  for (const log of allLogs) {
    if (log.type === "outgoing" && !outgoingByLead.has(log.leadId)) {
      outgoingByLead.set(log.leadId, log);
    }
  }

  const dealByLead = new Map<string, typeof deals[0]>();
  for (const d of deals) {
    if (d.leadId) dealByLead.set(d.leadId, d);
  }

  const threads = leads
    .filter(l => incomingByLead.has(l.id))
    .map(l => {
    const lastIncoming = incomingByLead.get(l.id)!;
    const lastOutgoing = outgoingByLead.get(l.id);
    const deal = dealByLead.get(l.id);
    const replyTime = new Date(lastIncoming.sentAt).getTime();
    const readAt = l.lastReadAt ? new Date(l.lastReadAt).getTime() : 0;
    const unread = readAt < replyTime;
    const replyText = lastIncoming.bodyHtml
      ? lastIncoming.bodyHtml.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 140)
      : "(no content)";
    const accountEmail = lastIncoming.emailAccount?.email || lastOutgoing?.emailAccount?.email || null;
    return {
      id: l.id,
      name: [l.firstName, l.lastName].filter(Boolean).join(" ") || l.email,
      email: l.email,
      campaignId: l.campaignId,
      campaignName: l.campaign?.name || null,
      emailAccountId: lastIncoming.emailAccountId || lastOutgoing?.emailAccountId || null,
      emailAccountEmail: accountEmail,
      subject: lastIncoming.subject || lastOutgoing?.subject || "No subject",
      replyPreview: replyText,
      time: timeAgo(lastIncoming.sentAt),
      lastReplyAt: lastIncoming.sentAt.toISOString(),
      unread,
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

  await prisma.lead.update({ where: { id: leadId }, data: { deletedAt: new Date() } });
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
