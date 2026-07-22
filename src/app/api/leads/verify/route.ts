export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyEmail, type SmtpConfig } from "@/lib/verify";
import { decryptAccount } from "@/lib/crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { leadIds, campaignId } = body;

  let leads;
  if (leadIds && Array.isArray(leadIds)) {
    leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, userId, deletedAt: null },
      select: { id: true, email: true, campaignId: true },
    });
  } else if (campaignId) {
    leads = await prisma.lead.findMany({
      where: { campaignId, userId, deletedAt: null },
      select: { id: true, email: true, campaignId: true },
    });
  } else {
    return NextResponse.json({ error: "Provide leadIds or campaignId" }, { status: 400 });
  }

  if (leads.length === 0) return NextResponse.json({ error: "No leads found" }, { status: 404 });

  let smtpConfig: SmtpConfig | undefined;
  const targetCampaignId = campaignId || leads[0]?.campaignId;
  if (targetCampaignId) {
    try {
      const campaign = await prisma.campaign.findUnique({ where: { id: targetCampaignId }, select: { accountIds: true } });
      if (campaign?.accountIds) {
        const accountIds: string[] = JSON.parse(campaign.accountIds);
        if (accountIds.length > 0) {
          const account = await prisma.emailAccount.findUnique({ where: { id: accountIds[0] } });
          if (account && account.smtpHost && account.smtpUser && account.smtpPass) {
            const decrypted = decryptAccount(account);
            smtpConfig = {
              host: decrypted.smtpHost || "",
              port: decrypted.smtpPort || 587,
              user: decrypted.smtpUser || "",
              pass: decrypted.smtpPass || "",
              email: decrypted.email || "",
            };
          }
        }
      }
    } catch (err) {
      console.error("[verify] Failed to resolve SMTP config, falling back to raw port 25:", err);
    }
  }

  if (!smtpConfig) {
    try {
      const firstAccount = await prisma.emailAccount.findFirst({ where: { userId } });
      if (firstAccount && firstAccount.smtpHost && firstAccount.smtpUser && firstAccount.smtpPass) {
        const decrypted = decryptAccount(firstAccount);
        smtpConfig = {
          host: decrypted.smtpHost || "",
          port: decrypted.smtpPort || 587,
          user: decrypted.smtpUser || "",
          pass: decrypted.smtpPass || "",
          email: decrypted.email || "",
        };
      }
    } catch {}
  }

  const BATCH_SIZE = 50;
  const summary = { total: leads.length, valid: 0, invalid: 0, risky: 0, catch_all: 0, unknown: 0 };

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (lead) => {
      try {
        const result = await verifyEmail(lead.email, smtpConfig);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { verificationStatus: result.status, verifiedAt: new Date(), provider: result.provider },
        });
        if (result.status === "valid") summary.valid++;
        else if (result.status === "invalid") summary.invalid++;
        else if (result.status === "risky") summary.risky++;
        else if (result.status === "catch_all") summary.catch_all++;
        else summary.unknown++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[verify] Failed to verify ${lead.email}:`, errMsg);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { verificationStatus: "unknown", verifiedAt: new Date() },
        });
        summary.unknown++;
      }
    }));

    if (i + BATCH_SIZE < leads.length) await sleep(1000);
  }

  return NextResponse.json(summary);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
