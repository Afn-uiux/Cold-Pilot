export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await req.json();
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: session.user.id, deletedAt: null },
    include: {
      steps: { orderBy: { order: "asc" } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let selectedIds: string[] = [];
  try { selectedIds = campaign.accountIds ? JSON.parse(campaign.accountIds) : []; } catch {}

  const accounts = await prisma.emailAccount.findMany({
    where: {
      userId: session.user.id,
      status: "active",
      deletedAt: null,
      ...(selectedIds.length > 0 ? { id: { in: selectedIds } } : {}),
    },
  });

  let score = 7;
  const reasons: string[] = [];

  if (accounts.length === 0) {
    score -= 3;
    reasons.push("No active email accounts connected");
  } else {
    const gmailCount = accounts.filter(a => a.provider === "Gmail").length;
    const smtpCount = accounts.filter(a => a.provider !== "Gmail").length;

    if (gmailCount > 0) {
      score += 1;
      reasons.push("Gmail accounts have high deliverability");
    }
    if (smtpCount > 0) {
      score -= 1;
      reasons.push("SMTP accounts may have lower deliverability");
    }
  }

  const totalSteps = campaign.steps.length;
  if (totalSteps > 5) {
    score -= 1;
    reasons.push("More than 5 steps may trigger spam filters");
  }
  if (totalSteps === 1) {
    score += 1;
    reasons.push("Single-step campaigns have better deliverability");
  }

  if (campaign.dailySendLimit && campaign.dailySendLimit < 50) {
    score += 1;
    reasons.push("Conservative daily limit helps deliverability");
  } else if (!campaign.dailySendLimit || campaign.dailySendLimit > 100) {
    score -= 1;
    reasons.push("High daily limit may trigger rate limits");
  }

  const accountIds = accounts.map(a => a.id);
  const hasWarmup = accountIds.length > 0 ? await prisma.warmupContent.findFirst({
    where: { senderMailboxId: { in: accountIds } },
  }) : null;
  if (hasWarmup) {
    score += 1;
    reasons.push("Warmup active — improves reputation");
  }

  if (accounts.some(a => a.warmupEnabled)) {
    score += 1;
    reasons.push("Warmup enabled — improves reputation");
  }

  score = Math.max(1, Math.min(10, score));

  return NextResponse.json({ score, reasons });
}
