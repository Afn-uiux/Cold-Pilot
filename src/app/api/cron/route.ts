export const runtime = "nodejs";

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
      where: { status: "active", deletedAt: null },
      select: { id: true, userId: true },
      take: 10,
    });

    const useQueue = process.env.REDIS_URL && process.env.REDIS_URL.startsWith("redis");

    // Reply detection must NOT be scoped to active campaigns: a lead can
    // (and often does) reply after their campaign has already finished
    // sending and moved to "completed". Previously this list was built from
    // activeCampaigns' userIds, so once all of a user's campaigns wrapped
    // up, replies from their leads silently stopped being picked up. Instead,
    // check replies for every user who has a connected, active email account.
    const accountsForReplyCheck = await prisma.emailAccount.findMany({
      where: { status: "active" },
      select: { userId: true },
      distinct: ["userId"],
    });
    const replyCheckUserIds = accountsForReplyCheck.map(a => a.userId);

    if (useQueue) {
      for (const campaign of activeCampaigns) {
        await enqueueJob("campaign", { campaignId: campaign.id, userId: campaign.userId });
      }
      // The queue path previously only enqueued campaign-send jobs and never
      // triggered reply checking at all, which is the same underlying bug as
      // above but worse (it affected active campaigns too, not just
      // completed ones). Enqueue a reply-check job per user regardless of
      // campaign status.
      for (const userId of replyCheckUserIds) {
        await enqueueJob("replyCheck", { userId });
      }
      return NextResponse.json({ queued: true, campaigns: activeCampaigns.length, replyChecksQueued: replyCheckUserIds.length });
    }

    const results = { campaignsRun: 0, totalSent: 0, totalErrors: 0, repliesFound: 0 };

    for (const campaign of activeCampaigns) {
      const result = await executeCampaign(campaign.id);
      results.campaignsRun++;
      results.totalSent += result.sent || 0;
      results.totalErrors += result.errors || 0;
    }

    for (const userId of replyCheckUserIds) {
      const replyResult = await checkForReplies(userId);
      results.repliesFound += replyResult.replied;
    }

    return NextResponse.json(results);
  } catch (err: any) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
