import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Each EmailLog row can represent up to five distinct activity events
// (sent/bounced at send time, then opened/clicked/replied whenever those
// timestamps get set later). This endpoint fans a row out into one item per
// event so the Activity tab can show the same granular, chronological feed
// Instantly shows — not just a daily bar chart.
type ActivityItem = {
  id: string;
  type: "sent" | "opened" | "clicked" | "replied" | "bounced";
  date: string;
  leadEmail: string;
  senderEmail: string;
  step: number | null;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "campaignId is required" }, { status: 400 });

  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const typeFilter = (url.searchParams.get("type") || "all").toLowerCase();
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId: session.user.id, deletedAt: null }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const steps = await prisma.campaignStep.findMany({ where: { campaignId }, select: { id: true, order: true } });
  const stepMap = new Map<string, number>(steps.map((s: { id: string; order: number }): [string, number] => [s.id, s.order + 1]));

  const logs = await prisma.emailLog.findMany({
    where: { lead: { campaignId } },
    select: {
      id: true, status: true, sentAt: true, openedAt: true, repliedAt: true, clickedAt: true,
      campaignStepId: true,
      lead: { select: { email: true } },
      emailAccount: { select: { email: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 5000, // safety cap on very large campaigns
  });

  const items: ActivityItem[] = [];
  for (const log of logs) {
    const leadEmail = log.lead?.email || "";
    const senderEmail = log.emailAccount?.email || "";
    const step = log.campaignStepId ? (stepMap.get(log.campaignStepId) ?? null) : null;

    if (log.status === "error" || log.status === "bounced") {
      items.push({ id: `${log.id}-bounced`, type: "bounced", date: log.sentAt.toISOString(), leadEmail, senderEmail, step });
    } else if (log.status === "sent" || log.status === "delivered" || log.status === "opened" || log.status === "clicked" || log.status === "replied") {
      items.push({ id: `${log.id}-sent`, type: "sent", date: log.sentAt.toISOString(), leadEmail, senderEmail, step });
    }
    if (log.openedAt) items.push({ id: `${log.id}-opened`, type: "opened", date: log.openedAt.toISOString(), leadEmail, senderEmail, step });
    if (log.clickedAt) items.push({ id: `${log.id}-clicked`, type: "clicked", date: log.clickedAt.toISOString(), leadEmail, senderEmail, step });
    if (log.repliedAt) items.push({ id: `${log.id}-replied`, type: "replied", date: log.repliedAt.toISOString(), leadEmail, senderEmail, step });
  }

  let filtered = items;
  if (typeFilter !== "all") filtered = filtered.filter(i => i.type === typeFilter);
  if (search) filtered = filtered.filter(i => i.leadEmail.toLowerCase().includes(search));

  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const page = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < filtered.length;

  return NextResponse.json({ items: page, total: filtered.length, hasMore });
}
