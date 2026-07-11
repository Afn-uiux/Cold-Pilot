import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";
import { executeCampaign, checkForReplies } from "@/engine/campaign";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: "active" },
      select: { id: true, userId: true },
      take: 10,
    });

    const useQueue = process.env.REDIS_URL && process.env.REDIS_URL.startsWith("redis");

    if (useQueue) {
      for (const campaign of activeCampaigns) {
        await enqueueJob("campaign", { campaignId: campaign.id, userId: campaign.userId });
      }
      return NextResponse.json({ queued: true, campaigns: activeCampaigns.length });
    }

    const results = { campaignsRun: 0, totalSent: 0, totalErrors: 0, repliesFound: 0 };

    for (const campaign of activeCampaigns) {
      const result = await executeCampaign(campaign.id);
      results.campaignsRun++;
      results.totalSent += result.sent || 0;
      results.totalErrors += result.errors || 0;
    }

    const userIds = [...new Set(activeCampaigns.map(c => c.userId))];
    for (const userId of userIds) {
      const replyResult = await checkForReplies(userId);
      results.repliesFound += replyResult.replied;
    }

    return NextResponse.json(results);
  } catch (err: any) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
