export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeUsers7d, totalCampaigns, activeCampaigns, totalLeads, totalEmailsSent, totalWarmupEmails, bounces7d, sent7d, verifiedLeads, suppressions, creditsOutstanding, pausedAccounts, flaggedUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
      prisma.campaign.count({ where: { deletedAt: null } }),
      prisma.campaign.count({ where: { status: "active", deletedAt: null } }),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.emailLog.count(),
      prisma.warmupLog.count({ where: { status: "sent" } }),
      prisma.bounceEvent.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.emailLog.count({
        where: { type: "outgoing", status: "sent", sentAt: { gte: sevenDaysAgo } },
      }),
      prisma.lead.count({ where: { deletedAt: null, verifiedAt: { not: null } } }),
      prisma.suppression.count(),
      prisma.user.aggregate({ _sum: { creditBalance: true } }),
      prisma.emailAccount.count({ where: { isPaused: true } }),
      prisma.user.count({ where: { OR: [{ riskStatus: "flagged" }, { riskStatus: "banned" }] } }),
    ]);

  return NextResponse.json({
    totalUsers,
    activeUsers7d,
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    totalEmailsSent,
    totalWarmupEmails,
    bounces7d,
    sent7d,
    verifiedLeads,
    suppressions,
    creditsOutstanding: creditsOutstanding._sum.creditBalance ?? 0,
    pausedAccounts,
    flaggedUsers,
  });
}
