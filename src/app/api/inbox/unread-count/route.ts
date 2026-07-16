import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Lightweight endpoint for the sidebar badge — only returns a count so it's
// cheap to poll frequently, unlike GET /api/inbox which loads full thread data.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repliedLeads = await prisma.lead.findMany({
    where: { userId: session.user.id, status: "replied", deletedAt: null },
    select: { id: true, lastReadAt: true },
  });

  if (repliedLeads.length === 0) return NextResponse.json({ count: 0 });

  const leadIds = repliedLeads.map(l => l.id);
  const latestIncoming = await prisma.emailLog.findMany({
    where: { leadId: { in: leadIds }, type: "incoming" },
    orderBy: { sentAt: "desc" },
    select: { leadId: true, sentAt: true },
  });

  const latestByLead = new Map<string, Date>();
  for (const log of latestIncoming) {
    if (!latestByLead.has(log.leadId)) latestByLead.set(log.leadId, log.sentAt);
  }

  let count = 0;
  for (const lead of repliedLeads) {
    const latest = latestByLead.get(lead.id);
    if (!latest) continue;
    const readAt = lead.lastReadAt ? new Date(lead.lastReadAt).getTime() : 0;
    if (readAt < new Date(latest).getTime()) count++;
  }

  return NextResponse.json({ count });
}
