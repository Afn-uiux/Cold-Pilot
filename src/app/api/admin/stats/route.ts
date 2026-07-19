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

  const [totalUsers, activeUsers7d, totalCampaigns, activeCampaigns, totalLeads, totalEmailsSent, totalWarmupEmails] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
      prisma.campaign.count({ where: { deletedAt: null } }),
      prisma.campaign.count({ where: { status: "active", deletedAt: null } }),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.emailLog.count(),
      prisma.warmupLog.count({ where: { status: "sent" } }),
    ]);

  return NextResponse.json({
    totalUsers,
    activeUsers7d,
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    totalEmailsSent,
    totalWarmupEmails,
  });
}
