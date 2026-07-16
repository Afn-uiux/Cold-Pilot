import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { extractBounceReason, extractBounceStatus } from "@/lib/bounce";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "30d";
  const campaignIdFilter = url.searchParams.get("campaignId") || undefined;

  const now = new Date();
  let dateFrom: Date | null = null;
  if (range === "7d") dateFrom = new Date(now.getTime() - 7 * 86400000);
  else if (range === "30d") dateFrom = new Date(now.getTime() - 30 * 86400000);
  else if (range === "90d") dateFrom = new Date(now.getTime() - 90 * 86400000);

  const dateFilter = dateFrom ? { sentAt: { gte: dateFrom } } : {};

  const campaignWhere: any = { userId: session.user.id, deletedAt: null };
  if (campaignIdFilter) campaignWhere.id = campaignIdFilter;

  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere,
    select: { id: true, name: true, status: true, openTracking: true, clickTracking: true, _count: { select: { leads: true } } },
  });

  const campaignIds = campaigns.map(c => c.id);

  const emailLogs = await prisma.emailLog.findMany({
    where: {
      lead: { userId: session.user.id, campaignId: { in: campaignIds } },
      ...dateFilter,
    },
    select: {
      id: true, status: true, openedAt: true, repliedAt: true, clickedAt: true,
      error: true, sentAt: true, campaignStepId: true, leadId: true,
      emailAccountId: true, bounceCategory: true,
      lead: { select: { email: true } },
      emailAccount: { select: { email: true } },
    },
  });

  // Status breakdown
  const leads = await prisma.lead.findMany({
    where: { userId: session.user.id, campaignId: { in: campaignIds }, deletedAt: null },
    select: { status: true, currentStep: true },
  });
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.status === "active" || l.status === "in_progress").length;
  const completedLeads = leads.filter(l => l.status === "completed" || l.status === "replied").length;
  const statusRate = totalLeads > 0 ? Math.round((activeLeads / totalLeads) * 100) : 0;
  const completionRate = totalLeads > 0 ? Math.round((completedLeads / totalLeads) * 100) : 0;

  // Leads that have started the sequence (have at least one email sent)
  const startedLeadIds = new Set(emailLogs.filter(e => e.status === "sent" || e.status === "delivered").map(e => e.leadId));
  const sequenceStarted = startedLeadIds.size;

  // Overall metrics
  const sent = emailLogs.filter(e => e.status === "sent" || e.status === "delivered").length;
  const delivered = emailLogs.filter(e => e.status === "sent" || e.status === "delivered" || e.status === "opened" || e.status === "clicked" || e.status === "replied").length;
  const openedLogs = emailLogs.filter(e => e.openedAt);
  const repliedLogs = emailLogs.filter(e => e.repliedAt);
  const clickedLogs = emailLogs.filter(e => e.clickedAt);
  const bounced = emailLogs.filter(e => e.status === "bounced" || e.error).length;

  // Unique metrics
  const uniqueLeadIds = new Set(emailLogs.map(e => e.leadId));
  const uniqueOpenLeadIds = new Set(openedLogs.map(e => e.leadId));
  const uniqueClickLeadIds = new Set(clickedLogs.map(e => e.leadId));

  const uniqueReplyLeadIds = new Set(repliedLogs.map(e => e.leadId));

  const totalOpens = openedLogs.length;
  const uniqueOpens = uniqueOpenLeadIds.size;
  const totalReplies = uniqueReplyLeadIds.size;
  const totalClicks = clickedLogs.length;
  const uniqueClicks = uniqueClickLeadIds.size;

  const openRate = delivered > 0 ? Math.round((uniqueOpens / delivered) * 1000) / 10 : 0;
  const clickRate = delivered > 0 ? Math.round((uniqueClicks / delivered) * 1000) / 10 : 0;
  const replyRate = sent > 0 ? Math.round((totalReplies / sent) * 1000) / 10 : 0;
  const bounceRate = sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0;

  // Step analytics per campaign
  const allSteps = await prisma.campaignStep.findMany({
    where: { campaign: { userId: session.user.id, ...(campaignIdFilter ? { id: campaignIdFilter } : {}) } },
    orderBy: [{ campaignId: "asc" }, { order: "asc" }],
  });

  const stepAnalytics: Record<string, { campaignId: string; campaignName: string; steps: any[] }> = {};

  for (const step of allSteps) {
    const campaign = campaigns.find(c => c.id === step.campaignId);
    if (!campaign) continue;

    if (!stepAnalytics[step.campaignId]) {
      stepAnalytics[step.campaignId] = { campaignId: step.campaignId, campaignName: campaign.name, steps: [] };
    }

    const stepLogs = emailLogs.filter(e => e.campaignStepId === step.id);
    const stepSentCount = stepLogs.filter(e => e.status === "sent" || e.status === "delivered").length;
    const stepOpenedCount = stepLogs.filter(e => e.openedAt).length;
    const stepRepliedCount = new Set(stepLogs.filter(e => e.repliedAt).map(e => e.leadId)).size;
    const stepClickedCount = stepLogs.filter(e => e.clickedAt).length;

    stepAnalytics[step.campaignId].steps.push({
      step: step.order + 1,
      sent: stepSentCount,
      opened: stepOpenedCount,
      openedPct: stepSentCount > 0 ? Math.round((stepOpenedCount / stepSentCount) * 10000) / 100 : 0,
      replied: stepRepliedCount,
      repliedPct: stepSentCount > 0 ? Math.round((stepRepliedCount / stepSentCount) * 10000) / 100 : 0,
      clicked: stepClickedCount,
      clickedPct: stepSentCount > 0 ? Math.round((stepClickedCount / stepSentCount) * 10000) / 100 : 0,
      opportunities: 0,
      opportunitiesPct: 0,
    });
  }

  // Bounce breakdown per step
  const bounceByStep: Record<string, { step: number; sent: number; hardBounce: number; softBounce: number; authError: number }> = {};
  for (const step of allSteps) {
    if (!campaignIds.includes(step.campaignId)) continue;
    const stepLogs = emailLogs.filter(e => e.campaignStepId === step.id);
    const stepSentCount = stepLogs.filter(e => e.status === "sent" || e.status === "delivered").length;
    const stepErrorLogs = stepLogs.filter(e => e.status === "error");
    bounceByStep[step.id] = {
      step: step.order + 1,
      sent: stepSentCount,
      hardBounce: stepErrorLogs.filter(e => e.bounceCategory === "hard_bounce").length,
      softBounce: stepErrorLogs.filter(e => e.bounceCategory === "soft_bounce").length,
      authError: stepErrorLogs.filter(e => e.bounceCategory === "auth_error").length,
    };
  }

  // Bounce summary
  const errorLogs = emailLogs.filter(e => e.status === "error");
  const totalBounces = errorLogs.length;
  const hardBounces = errorLogs.filter(e => e.bounceCategory === "hard_bounce").length;
  const softBounces = errorLogs.filter(e => e.bounceCategory === "soft_bounce").length;
  const unknownBounces = errorLogs.filter(e => !e.bounceCategory || e.bounceCategory === "").length;

  // Bounce reasons breakdown
  const reasonMap = new Map<string, number>();
  for (const log of errorLogs) {
    const reason = extractBounceReason({ message: log.error || "" });
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  }
  const bounceReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count, percentage: totalBounces > 0 ? Math.round((count / totalBounces) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // Recent bounced leads
  const stepMap = new Map(allSteps.map(s => [s.id, s.order + 1]));
  const recentBouncedLeads = errorLogs
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, 50)
    .map(log => ({
      id: log.id,
      date: log.sentAt.toISOString(),
      leadEmail: (log as any).lead?.email || "",
      senderEmail: (log as any).emailAccount?.email || "",
      type: log.bounceCategory || "unknown",
      reason: extractBounceReason({ message: log.error || "" }),
      status: extractBounceStatus({ message: log.error || "" }),
      step: log.campaignStepId ? `Step ${stepMap.get(log.campaignStepId) || "?"}` : "",
    }));

  // Activity
  const activityMap = new Map<string, number>();
  for (const log of emailLogs) {
    if (log.status === "sent" || log.status === "delivered") {
      const day = log.sentAt.toISOString().slice(0, 10);
      activityMap.set(day, (activityMap.get(day) || 0) + 1);
    }
  }
  const activity = Array.from(activityMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;

  return NextResponse.json({
    summary: {
      status: campaignIdFilter ? (campaigns[0]?.status || "draft") : null,
      statusRate,
      completionRate,
      sequenceStarted,
      openRate,
      clickRate,
      replyRate,
      bounceRate,
      opportunities: 0,
      conversions: 0,
    },
    detailed: {
      sent,
      delivered,
      totalOpens,
      uniqueOpens,
      totalReplies,
      totalClicks,
      uniqueClicks,
      bounced,
    },
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leads: c._count.leads,
      openTracking: c.openTracking,
      clickTracking: c.clickTracking,
    })),
    totalCampaigns,
    activeCampaigns,
    stepAnalytics: Object.values(stepAnalytics),
    bounceByStep: Object.values(bounceByStep),
    bounceSummary: { total: totalBounces, hardBounces, softBounces, unknownBounces },
    bounceReasons,
    recentBouncedLeads,
    activity,
  });
}
