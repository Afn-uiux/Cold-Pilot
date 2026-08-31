export const runtime = "nodejs";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyEmail, type SmtpConfig } from "@/lib/verify";
import { decryptAccount } from "@/lib/crypto";
import { spendCredits, InsufficientCreditsError } from "@/lib/credits";
import { rateLimitAsync } from "@/lib/rate-limit";
import { CREDIT_COSTS } from "@/lib/plans";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Per-user throttle. Verification fans out to external SMTP servers (port 25)
  // and spends credits, so an unthrottled loop is both an SMTP-probe amplifier
  // and a way to burn a victim's balance. Each request already batches up to
  // hundreds of leads, so a modest request rate is plenty for the UI.
  const rl = await rateLimitAsync(`verify:${userId}`, { max: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many verification requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

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

  const creditCost = leads.length * CREDIT_COSTS.verification;
  try {
    // Unique per-call refId. Keying idempotency on campaignId/leadId meant the
    // second (and every later) verification of the same campaign matched an
    // existing charge and ran FOR FREE. Verification is an explicit,
    // user-initiated action, so each request is its own billable event.
    await spendCredits(userId, creditCost, "verification", `verify:${crypto.randomUUID()}`);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Verifying ${leads.length} leads costs ${creditCost} credits and you have ${err.balance}. Top up credits or upgrade your plan.`,
          code: "INSUFFICIENT_CREDITS",
          balance: err.balance,
          required: creditCost,
        },
        { status: 402 }
      );
    }
    throw err;
  }

  let smtpConfig: SmtpConfig | undefined;
  const targetCampaignId = campaignId || leads[0]?.campaignId;
  if (targetCampaignId) {
    try {
      const campaign = await prisma.campaign.findFirst({ where: { id: targetCampaignId, userId }, select: { accountIds: true } });
      if (campaign?.accountIds) {
        const accountIds: string[] = JSON.parse(campaign.accountIds);
        if (accountIds.length > 0) {
          const account = await prisma.emailAccount.findFirst({ where: { id: accountIds[0], userId } });
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
  const summary = { total: leads.length, valid: 0, invalid: 0, risky: 0, unknown: 0 };

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