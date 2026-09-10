import { prisma } from "@/lib/prisma";
import { sendEmail, normalizeMessageId } from "./send";
import { personalizeText } from "./personalize";
import { createNotification } from "@/lib/notify";
import { dispatchWebhookEvent } from "@/lib/webhook";
import { dispatchIntegrationEvent } from "@/integrations";
import { classifyReply } from "@/lib/classify";
import { categorizeBounce } from "@/lib/bounce";
import { sendEmailSafe } from "@/lib/email/send";
import { sanitizeHtml } from "@/lib/sanitize";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decryptAccount } from "@/lib/crypto";
import { canSendToLead } from "@/lib/verify";
import { canSendFromAccount } from "@/lib/send-gate";
import { recordBounce, recordSend } from "@/lib/domain-reputation";
import { spendCredits, InsufficientCreditsError } from "@/lib/credits";
import { assertSafeMailTarget } from "@/lib/ssrf";
import { CREDIT_COSTS } from "@/lib/plans";

function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Build the personalization map for a lead, merging standard fields with
// any custom fields the user imported so ANY variable tag resolves by name.
function leadVars(lead: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string;
  title: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  personalization: string | null;
  customFields: string | null;
}, accountSignature: string): Record<string, string> {
  const vars: Record<string, string> = {
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    company: lead.company || "",
    companyName: lead.company || "",
    email: lead.email,
    title: lead.title || "",
    phone: lead.phone || "",
    website: lead.website || "",
    location: lead.location || "",
    signature: accountSignature,
    accountSignature,
    personalization: lead.personalization || "",
  };
  if (lead.customFields) {
    try {
      const cf = JSON.parse(lead.customFields) as Record<string, unknown>;
      for (const [k, v] of Object.entries(cf)) {
        if (typeof v !== "string" || !v.trim()) continue;
        const lower = k.toLowerCase();
        if (!vars[lower] && !(lower in vars)) vars[lower] = v.trim();
      }
    } catch {
      // ignore malformed customFields
    }
  }
  return vars;
}

function isWithinSchedule(campaign: { startDate: Date | null; endDate: Date | null; noEndDate: boolean; schedules: { startTime: string; endTime: string; timezone: string; days: string }[] }): boolean {
  const now = new Date();

  // Date range check
  if (campaign.startDate && now < campaign.startDate) return false;
  if (!campaign.noEndDate && campaign.endDate && now > campaign.endDate) return false;

  // No schedules defined → allow anytime
  if (!campaign.schedules || campaign.schedules.length === 0) return true;

  const dayNames = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  for (const sch of campaign.schedules) {
    const days: boolean[] = typeof sch.days === "string" ? JSON.parse(sch.days) : sch.days;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: sch.timezone,
      hour: "numeric", minute: "numeric", weekday: "short",
      hour12: false,
    } as any);
    const parts = fmt.formatToParts(now);

    const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
    const weekday = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "";
    const dayIndex = dayNames.indexOf(weekday);
    const currentMins = hour * 60 + minute;

    // Parse start/end times
    const [sh, sm] = sch.startTime.split(":").map(Number);
    const [eh, em] = sch.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    const dayEnabled = dayIndex >= 0 && dayIndex <= 6 ? days[dayIndex] : false;
    const withinTime = endMins > startMins
      ? currentMins >= startMins && currentMins < endMins
      : currentMins >= startMins || currentMins < endMins; // overnight schedule

    if (dayEnabled && withinTime) return true;
  }

  return false;
}

/**
 * Calculate how many emails should have been sent by now based on the
 * schedule window. This spreads sends evenly across the window instead
 * of bunching them at the start.
 *
 * Returns the cumulative number of emails that should be sent by now
 * (capped at totalCapacity).
 */
function calculateScheduledSendCount(
  schedule: { startTime: string; endTime: string; timezone: string },
  totalCapacity: number,
): number {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timezone,
    hour: "numeric", minute: "numeric",
    hour12: false,
  } as any);
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
  const currentMins = hour * 60 + minute;

  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const [eh, em] = schedule.endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  const windowMins = endMins - startMins;
  if (windowMins <= 0) return totalCapacity; // invalid window, send all

  const elapsed = currentMins - startMins;
  if (elapsed <= 0) return 0; // not started yet
  if (elapsed >= windowMins) return totalCapacity; // window ended, send all

  return Math.floor((elapsed / windowMins) * totalCapacity);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Promote leads that are past their final email step ("currentStep" is the
// index of the NEXT email step to send, so currentStep >= emailStepCount means
// there is nothing left to send) to "completed", then — if every lead is done —
// flip the campaign to "completed", dispatch the integration event, and send
// the user a completion email with REAL numbers pulled from the DB.
async function maybeCompleteCampaign(campaign: {
  id: string;
  userId: string;
  name: string;
  steps: { type: string }[];
}): Promise<boolean> {
  const emailStepCount = campaign.steps.filter(s => s.type === "email").length;

  // Leads with no remaining email step can never be sent again — outside the
  // schedule window the send loop never runs, so promote them here instead of
  // waiting for a reply to move the lead out of "sent".
  await prisma.lead.updateMany({
    where: {
      campaignId: campaign.id,
      status: "sent",
      currentStep: { gte: emailStepCount },
      deletedAt: null,
    },
    data: { status: "completed" },
  });

  const remaining = await prisma.lead.count({
    where: { campaignId: campaign.id, status: { in: ["pending", "sent"] }, deletedAt: null },
  });
  if (remaining > 0) return false;

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "completed" } });

  const [sent, opened, replied, bounced] = await Promise.all([
    prisma.emailLog.count({ where: { lead: { campaignId: campaign.id }, type: "outgoing", status: "sent" } }),
    prisma.emailLog.count({ where: { lead: { campaignId: campaign.id }, type: "outgoing", status: "sent", openedAt: { not: null } } }),
    prisma.lead.count({ where: { campaignId: campaign.id, status: "replied" } }),
    prisma.lead.count({ where: { campaignId: campaign.id, status: "bounced" } }),
  ]);

  dispatchIntegrationEvent(campaign.userId, "campaign_completed", {
    name: campaign.name,
    sent,
    replies: replied,
    opened,
    bounced,
  }).catch(() => {});

  const campaignUser = await prisma.user.findUnique({ where: { id: campaign.userId }, select: { email: true } });
  if (campaignUser?.email) {
    sendEmailSafe(campaignUser.email, "campaign-completed", { sent, opened, replied, bounced });
  }

  return true;
}

function cleanReplyBody(raw: string): string {
  let body = raw;
  // Strip MIME headers that leak into the body (Content-Type, Content-Transfer-Encoding, etc.)
  body = body.replace(/^[A-Z][\w-]*:\s*[^\n]+\n/gim, "");
  // Strip the "On <date>, <name> wrote:" introduction line and everything after it
  body = body.replace(/On\s+.+wrote:\s*[\s\S]*$/im, "");
  // Strip quoted lines (starting with >)
  body = body.split("\n").filter(line => !line.trimStart().startsWith(">")).join("\n");
  // Strip HTML tags if any
  body = body.replace(/<[^>]*>/g, "");
  // Collapse multiple blank lines
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  return body.slice(0, 2000);
}

const runningCampaigns = new Set<string>();

export async function executeCampaign(campaignId: string) {
  if (runningCampaigns.has(campaignId)) {
    return { sent: 0, errors: 0, skipped: 0, reason: "already_running" };
  }
  runningCampaigns.add(campaignId);
  try {
    return await executeCampaignInner(campaignId);
  } finally {
    runningCampaigns.delete(campaignId);
  }
}

async function executeCampaignInner(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, deletedAt: null },
    include: {
      steps: { orderBy: { order: "asc" } },
      schedules: true,
      user: { select: { plan: true } },
    },
  });

  if (!campaign || campaign.status !== "active") return { sent: 0, errors: 0, skipped: 0 };

  // Auto-complete: if no leads are pending or awaiting follow-up, mark campaign
  // done. Runs BEFORE the schedule gate so campaigns outside their send window
  // still complete once every lead is finished.
  const alreadyDone = await maybeCompleteCampaign(campaign);
  if (alreadyDone) return { sent: 0, errors: 0, skipped: 0, reason: "completed" };

  if (!isWithinSchedule(campaign)) return { sent: 0, errors: 0, skipped: 0, reason: "outside_schedule" };

  // Use selected account IDs if set, otherwise use all active accounts
  let selectedIds: string[] = [];
  try { selectedIds = campaign.accountIds ? JSON.parse(campaign.accountIds) : []; } catch {}

  const rawAccounts = await prisma.emailAccount.findMany({
    where: {
      userId: campaign.userId,
      status: "active",
      deletedAt: null,
      ...(selectedIds.length > 0 ? { id: { in: selectedIds } } : {}),
    },
  });
  const accounts = rawAccounts.map(a => decryptAccount(a));
  if (accounts.length === 0) return { sent: 0, errors: 0, reason: "no_accounts" };

  // Get all leads for this campaign — pending (unsent), sent (awaiting follow-up), or active
  // Leads that have replied are excluded via status filter ("replied" not in ["pending", "sent"])
  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      userId: campaign.userId,
      status: { in: ["pending", "sent"] },
      deletedAt: null,
    },
  });

  const emailSteps = campaign.steps.filter(s => s.type === "email");
  const emailStepIds = emailSteps.map(s => s.id);
  if (emailSteps.length === 0) return { sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;
  let skipped = 0;
  let emailCount = 0;

  // Count emails already sent today for this campaign (persists across ticks)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySent = await prisma.emailLog.count({
    where: {
      lead: { campaignId },
      type: "outgoing",
      status: "sent",
      sentAt: { gte: todayStart },
    },
  });

  // Schedule-aware pacing: if schedules are set, spread sends evenly across the window
  let campaignCap = campaign.dailySendLimit || 30;
  if (campaign.slowRamp && campaign.rampStart) {
    const daysSince = Math.floor((Date.now() - new Date(campaign.rampStart).getTime()) / 86400000);
    campaignCap = Math.min(1 + daysSince * 2, campaignCap);
  }

  if (campaign.schedules && campaign.schedules.length > 0) {
    // Use the first matching schedule to determine pacing
    const matchingSchedule = campaign.schedules.find(s => {
      const days: boolean[] = typeof s.days === "string" ? JSON.parse(s.days) : s.days;
      const dayNames = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: s.timezone, weekday: "short", hour12: false,
      } as any);
      const parts = fmt.formatToParts(new Date());
      const weekday = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "";
      const dayIndex = dayNames.indexOf(weekday);
      return dayIndex >= 0 && dayIndex <= 6 ? days[dayIndex] : false;
    });

    if (matchingSchedule) {
      const scheduledTotal = calculateScheduledSendCount(matchingSchedule, campaignCap);
      const remaining = Math.max(0, scheduledTotal - todaySent);
      if (remaining <= 0) {
        return { sent: 0, errors: 0, skipped: 0, reason: "schedule_paced" };
      }
      campaignCap = todaySent + remaining; // cap at what's scheduled by now
    }
  }

  const minGap = (campaign.minTimeBetween || 0) * 60 * 1000;
  const maxExtra = (campaign.randomExtraTime || 0) * 60 * 1000;
  let nextAllowed = campaign.nextAllowedSendAt ? campaign.nextAllowedSendAt.getTime() : 0;

  // Assign leads without a sticky account via round-robin
  const unassignedLeads = leads.filter(l => !(l as any).sendingAccountId);
  if (unassignedLeads.length > 0) {
    for (let i = 0; i < unassignedLeads.length; i++) {
      const account = accounts[i % accounts.length];
      await prisma.lead.update({
        where: { id: unassignedLeads[i].id },
        data: { sendingAccountId: account.id },
      });
    }
  }

  // Reload leads with updated sendingAccountId
  const updatedLeads = await prisma.lead.findMany({
    where: { campaignId, status: { in: ["pending", "sent"] }, deletedAt: null },
  });

  for (const lead of updatedLeads) {
    // Re-check campaign status before each lead — if the user paused mid-tick,
    // stop sending immediately instead of burning through claimed leads.
    const freshCampaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!freshCampaign || freshCampaign.status !== "active") {
      console.log(`[campaign] Campaign ${campaignId} is no longer active (status=${freshCampaign?.status}), stopping mid-tick`);
      break;
    }

    const account = accounts.find(a => a.id === lead.sendingAccountId) || accounts[emailCount % accounts.length];
    const currentStepIdx = lead.currentStep || 0;
    const step = emailSteps[currentStepIdx];
    const accountSignature = sanitizeHtml((account as any)?.signature || "");

    if (!step) {
      if (lead.status === "sent") {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "completed" } });
      }
      continue;
    }

    const stepHasContent = Boolean(step.subject?.trim()) || Boolean(step.bodyHtml?.trim());
    if (!stepHasContent) {
      console.error(`[campaign] step ${step.id} (order ${step.order}) has no subject or body — skipping send for lead ${lead.id}`);
      skipped++;
      continue;
    }

    if (todaySent + emailCount >= campaignCap) { skipped++; continue; }

    const waitMs = nextAllowed - Date.now();
    if (waitMs > 0) {
      console.log(`[campaign] Pacing: waiting ${Math.round(waitMs / 1000)}s before next send (nextAllowed=${new Date(nextAllowed).toISOString()})`);
      await sleep(waitMs);
    }

    // Phase 1: Send initial email to pending leads
    if (lead.status === "pending" && currentStepIdx === 0) {
      const claimResult = await prisma.lead.updateMany({
        where: { id: lead.id, status: "pending", currentStep: 0 },
        data: { status: "sent", currentStep: 1, lastSentAt: new Date() },
      });
      if (claimResult.count === 0) { skipped++; continue; }

      const sendCheck = canSendToLead(lead.verificationStatus, campaign.enableRiskyEmails, campaign.disableBounceProtect);
      if (!sendCheck.allowed) {
        console.log(`[campaign] Skipping ${lead.email}: ${sendCheck.reason}`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "pending", currentStep: 0, lastSentAt: null },
        });
        skipped++;
        continue;
      }

      const accountGate = await canSendFromAccount(account.id, account.dailySendLimit || 30);
      if (!accountGate.allowed) {
        console.log(`[campaign] Account gate: ${lead.email} blocked — ${accountGate.reason}`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "pending", currentStep: 0, lastSentAt: null },
        });
        skipped++;
        continue;
      }

      try {
        const vars = leadVars(lead, accountSignature);

        let subject: string;
        let htmlBody: string;
        const leadSeed = seedFromId(lead.id);
        subject = personalizeText(step.subject || "Hello", vars, leadSeed).replace(/\{\{[^{}]+\}\}/g, "");

        const { signature: _sig, accountSignature: _asig, ...varsNoSignature } = vars;
        htmlBody = personalizeText(step.bodyHtml || "", varsNoSignature, leadSeed);
        htmlBody = htmlBody
          .replace(/\{\{signature\}\}/gi, accountSignature)
          .replace(/\{\{accountSignature\}\}/gi, accountSignature)
          .replace(/\{\{[^{}]+\}\}/g, "");
        htmlBody = sanitizeHtml(htmlBody);

        // Deduct 1 credit before sending (only for free/pay-as-you-go users).
        // Paid subscribers send for free — credits only used for verification/AI.
        if (campaign.user?.plan === "free") {
          try {
            await spendCredits(campaign.userId, CREDIT_COSTS.campaign, "campaign_send", `campaign_send:${lead.id}:${step.id}`);
          } catch (err) {
            if (err instanceof InsufficientCreditsError) {
              await prisma.campaign.update({ where: { id: campaignId }, data: { status: "paused", resumeOnFunding: true } });
              createNotification({
                userId: campaign.userId,
                type: "credits",
                title: "Out of Credits",
                message: `Campaign "${campaign.name}" paused — you've run out of credits. Buy more to continue sending.`,
                link: "/dashboard/settings?tab=Billing",
              }).catch(() => {});
              return { sent, errors, skipped, reason: "insufficient_credits" };
            }
            throw err;
          }
        }

        await sendEmail({
          to: lead.email,
          subject,
          htmlBody,
          fromName: account.displayName || undefined,
          emailAccountId: account.id,
          leadId: lead.id,
          campaignStepId: step.id,
          trackingId: lead.id,
          openTracking: campaign.openTracking,
          clickTracking: campaign.clickTracking,
          unsubscribeHeader: campaign.unsubscribeHeader,
          plainTextOnly: campaign.plainTextOnly || campaign.firstEmailPlainText,
          enableRiskyEmails: campaign.enableRiskyEmails,
        });

        recordSend(lead.email).catch(() => {});
        sent++;
        emailCount++;
        nextAllowed = Date.now() + minGap + (maxExtra > 0 ? Math.random() * maxExtra : 0);
        await prisma.campaign.update({ where: { id: campaignId }, data: { nextAllowedSendAt: new Date(nextAllowed) } });
      } catch (err: any) {
        console.error(`Failed to send initial to ${lead.email}:`, err);
        const bounce = categorizeBounce(err);
        if (bounce.type === "hard_bounce" && bounce.suppress) {
          recordBounce(lead.email, null, bounce.type, bounce.type, account.id, lead.id).catch(() => {});
          // Terminal failure — mark lead as bounced so it is never retried.
          await prisma.suppression.upsert({
            where: { userId_email: { userId: campaign.userId, email: lead.email.toLowerCase().trim() } },
            create: { userId: campaign.userId, email: lead.email.toLowerCase().trim(), reason: bounce.type, type: "bounce" },
            update: {},
          });
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "bounced" },
          });
          createNotification({
            userId: campaign.userId,
            type: "bounce",
            title: "Email Bounced",
            message: `${lead.email} — ${bounce.type}`,
          }).catch(() => {});
          dispatchWebhookEvent({ event: "bounce", userId: campaign.userId, data: { leadId: lead.id, email: lead.email, reason: bounce.type } }).catch(() => {});
          dispatchIntegrationEvent(campaign.userId, "bounce", { email: lead.email, reason: bounce.type }).catch(() => {});
        } else {
          // Transient error (connection, timeout, auth) — roll back so it can be retried later.
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "pending", currentStep: 0, lastSentAt: null },
          });
        }
        errors++;
      }
      continue;
    }

    // Phase 2: Send follow-ups to leads that have been sent to
    if (lead.status === "sent" && currentStepIdx > 0 && lead.lastSentAt) {
      const delayVal = step.delayDays ?? 0;
      const delayUnit = step.delayUnit || "days";
      let delayMs: number;
      if (delayUnit === "minutes") {
        delayMs = delayVal * 60 * 1000;
      } else if (delayUnit === "hours") {
        delayMs = delayVal * 60 * 60 * 1000;
      } else {
        delayMs = delayVal * 24 * 60 * 60 * 1000;
      }
      const isDue = Date.now() - lead.lastSentAt.getTime() >= delayMs;

      if (!isDue) { skipped++; continue; }

      const nextStep = currentStepIdx + 1;
      const claimFup = await prisma.lead.updateMany({
        where: { id: lead.id, currentStep: currentStepIdx, status: "sent" },
        data: {
          currentStep: nextStep,
          lastSentAt: new Date(),
          status: nextStep >= emailSteps.length ? "completed" : "sent",
        },
      });
      if (claimFup.count === 0) { skipped++; continue; }

      const fupSendCheck = canSendToLead(lead.verificationStatus, campaign.enableRiskyEmails, campaign.disableBounceProtect);
      if (!fupSendCheck.allowed) {
        console.log(`[campaign] Skipping follow-up to ${lead.email}: ${fupSendCheck.reason}`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { currentStep: currentStepIdx, status: "sent", lastSentAt: lead.lastSentAt },
        });
        skipped++;
        continue;
      }

      const fupAccountGate = await canSendFromAccount(account.id, account.dailySendLimit || 30);
      if (!fupAccountGate.allowed) {
        console.log(`[campaign] Follow-up account gate: ${lead.email} blocked — ${fupAccountGate.reason}`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { currentStep: currentStepIdx, status: "sent", lastSentAt: lead.lastSentAt },
        });
        skipped++;
        continue;
      }

      try {
        const priorLogs = await prisma.emailLog.findMany({
          where: { leadId: lead.id, type: "outgoing", campaignStepId: { in: emailStepIds } },
          orderBy: { sentAt: "asc" },
          select: { messageId: true, threadId: true, subject: true },
        });
        const lastLog = priorLogs[priorLogs.length - 1] || null;
        const referencesChain = priorLogs.map(l => l.messageId).filter((id): id is string => !!id).map(id => normalizeMessageId(id)).join(" ") || null;
        const firstSubject = priorLogs[0]?.subject || "";

        let fupSubject = firstSubject
          ? firstSubject
          : step.subject || "Re: Your conversation with Coldpilot";
        let fupBody = step.bodyHtml || "";
        const fupVars = leadVars(lead, accountSignature);
        fupSubject = personalizeText(fupSubject, fupVars, seedFromId(lead.id)).replace(/\{\{[^{}]+\}\}/g, "");

        const { signature: _fsig, accountSignature: _fasig, ...fupVarsNoSignature } = fupVars;
        fupBody = personalizeText(fupBody, fupVarsNoSignature, seedFromId(lead.id));
        fupBody = fupBody
          .replace(/\{\{signature\}\}/gi, accountSignature)
          .replace(/\{\{accountSignature\}\}/gi, accountSignature)
          .replace(/\{\{[^{}]+\}\}/g, "");

        if (lastLog && !/^re:/i.test(fupSubject.trim())) {
          fupSubject = `Re: ${fupSubject}`;
        }

        // Deduct 1 credit before follow-up send (only for free/pay-as-you-go users).
        // Paid subscribers send for free.
        if (campaign.user?.plan === "free") {
          try {
            await spendCredits(campaign.userId, CREDIT_COSTS.campaign, "campaign_send", `campaign_send:${lead.id}:${step.id}`);
          } catch (err) {
            if (err instanceof InsufficientCreditsError) {
              await prisma.campaign.update({ where: { id: campaignId }, data: { status: "paused", resumeOnFunding: true } });
              createNotification({
                userId: campaign.userId,
                type: "credits",
                title: "Out of Credits",
                message: `Campaign "${campaign.name}" paused — you've run out of credits. Buy more to continue sending.`,
                link: "/dashboard/settings?tab=Billing",
              }).catch(() => {});
              return { sent, errors, skipped, reason: "insufficient_credits" };
            }
            throw err;
          }
        }

        await sendEmail({
          to: lead.email,
          subject: fupSubject,
          htmlBody: fupBody,
          fromName: account.displayName || undefined,
          emailAccountId: account.id,
          leadId: lead.id,
          campaignStepId: step.id,
          trackingId: lead.id,
          openTracking: campaign.openTracking,
          clickTracking: campaign.clickTracking,
          threadId: lastLog?.threadId || undefined,
          inReplyTo: lastLog?.messageId || null,
          references: referencesChain,
          unsubscribeHeader: campaign.unsubscribeHeader,
          plainTextOnly: campaign.plainTextOnly,
          enableRiskyEmails: campaign.enableRiskyEmails,
        });

        recordSend(lead.email).catch(() => {});
        sent++;
        emailCount++;
        nextAllowed = Date.now() + minGap + (maxExtra > 0 ? Math.random() * maxExtra : 0);
        await prisma.campaign.update({ where: { id: campaignId }, data: { nextAllowedSendAt: new Date(nextAllowed) } });
      } catch (err: any) {
        console.error(`Failed to send follow-up to ${lead.email}:`, err);
        const bounce = categorizeBounce(err);
        if (bounce.type === "hard_bounce" && bounce.suppress) {
          recordBounce(lead.email, null, bounce.type, bounce.type, account.id, lead.id).catch(() => {});
          // Terminal failure — mark lead as bounced so it is never retried.
          await prisma.suppression.upsert({
            where: { userId_email: { userId: campaign.userId, email: lead.email.toLowerCase().trim() } },
            create: { userId: campaign.userId, email: lead.email.toLowerCase().trim(), reason: bounce.type, type: "bounce" },
            update: {},
          });
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "bounced" },
          });
          createNotification({
            userId: campaign.userId,
            type: "bounce",
            title: "Email Bounced",
            message: `${lead.email} — ${bounce.type}`,
          }).catch(() => {});
          dispatchWebhookEvent({ event: "bounce", userId: campaign.userId, data: { leadId: lead.id, email: lead.email, reason: bounce.type } }).catch(() => {});
          dispatchIntegrationEvent(campaign.userId, "bounce", { email: lead.email, reason: bounce.type }).catch(() => {});
        } else {
          // Transient error — roll back step so it can be retried.
          await prisma.lead.update({
            where: { id: lead.id },
            data: { currentStep: currentStepIdx, status: "sent" },
          });
        }
        errors++;
      }
    }
  }

  // Final completion check — mark campaign done if all leads are processed
  const allDone = await maybeCompleteCampaign(campaign);
  if (allDone) return { sent, errors, skipped, reason: "completed" };

  return { sent, errors, skipped };
}

async function processReply(
  log: { id: string; leadId: string; threadId: string | null },
  account: { id: string; email: string },
  replySubject: string,
  replyBody: string,
  replyMessageId?: string | null,
): Promise<boolean> {
  // Dedup guard: every outgoing send (initial email, follow-up, or a manual
  // reply sent from the inbox) opens a new pending ("repliedAt: null") log
  // on the same thread. If the lead's most recent message in that thread
  // hasn't changed since the last time we checked, the thread-scanning
  // reply checkers would otherwise re-match that same old lead message
  // against the newer outgoing log and process it all over again — that's
  // what caused the same lead reply to show up twice (once as a fresh
  // "reply" right after a manual reply was sent). If we've already recorded
  // this exact incoming message for this lead, just close out this pending
  // log without creating a duplicate notification/deal update.
  if (replyMessageId) {
    const alreadyProcessed = await prisma.emailLog.findFirst({
      where: { leadId: log.leadId, type: "incoming", messageId: replyMessageId },
    });
    if (alreadyProcessed) {
      return false;
    }
  }

  await prisma.emailLog.update({
    where: { id: log.id },
    data: { repliedAt: new Date() },
  });
  await prisma.emailLog.create({
    data: {
      leadId: log.leadId,
      emailAccountId: account.id,
      type: "incoming",
      status: "received",
      subject: replySubject,
      bodyHtml: sanitizeHtml(replyBody || ""),
      threadId: log.threadId,
      messageId: replyMessageId || null,
      sentAt: new Date(),
    },
  });
  const lead = await prisma.lead.findUnique({ where: { id: log.leadId } });
  if (!lead) return false;

  await prisma.lead.update({ where: { id: lead.id }, data: { status: "replied" } });
  const classification = classifyReply(replySubject, replyBody);

  // Check campaign stop flags — only create deal if not stopped
  const campaign = await prisma.campaign.findUnique({ where: { id: lead.campaignId! } });
  if (campaign) {
    if (classification === "auto_reply" && !campaign.stopOnAutoReply) {
      // Auto-reply but stopOnAutoReply is off — revert status so follow-ups continue
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "sent" } });
      return true;
    }
    if (classification === "negative" && !campaign.stopOnReply) {
      // Negative reply but stopOnReply is off — revert status
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "sent" } });
      return true;
    }
  }

  const stageMap: Record<string, string> = { positive: "lead", neutral: "lead", negative: "not_interested", auto_reply: "out_of_office" };
  let dealStage = stageMap[classification] || "lead";
  const replyText = `${replySubject} ${replyBody}`.toLowerCase();
  const meetingWords = ["calendly", "meeting", "scheduled", "booked", "calendar", "confirmed", "look forward to meeting", "scheduling", "call scheduled", "set up a time", "availability", "i booked"];
  const wonWords = ["signed", "agreed", "deal", "purchase", "order", "contract", "let's proceed", "let's do it", "approved", "we're in", "go ahead", "we accept"];
  const noShowWords = ["missed", "forgot", "reschedule", "couldn't make", "ran late", "missed the call"];
  if (meetingWords.some(w => replyText.includes(w))) dealStage = "meeting_booked";
  else if (wonWords.some(w => replyText.includes(w))) dealStage = "won";
  else if (noShowWords.some(w => replyText.includes(w))) dealStage = "no_show";

  createNotification({
    userId: lead.userId,
    type: "reply",
    title: "New Reply",
    message: `${lead.email} replied to your campaign`,
    link: `/dashboard/inbox?leadId=${lead.id}`,
  }).catch(() => {});
  dispatchWebhookEvent({ event: "reply", userId: lead.userId, data: { leadId: lead.id, email: lead.email } }).catch(() => {});
  dispatchIntegrationEvent(lead.userId, "reply", { email: lead.email }).catch(() => {});

  try {
    let pipeline = await prisma.pipeline.findFirst({ where: { userId: lead.userId } });
    if (!pipeline) {
      pipeline = await prisma.pipeline.create({
        data: { userId: lead.userId, name: "Sales Pipeline", stages: JSON.stringify(["lead", "interested", "meeting_booked", "meeting_completed", "won", "no_show", "out_of_office", "wrong_person", "not_interested", "lost"]) },
      });
    }
    const existingDeal = await prisma.deal.findFirst({ where: { leadId: lead.id } });
    if (existingDeal) {
      if (dealStage !== existingDeal.stage && dealStage !== "lead") {
        await prisma.deal.update({ where: { id: existingDeal.id }, data: { stage: dealStage } });
      }
    } else {
      await prisma.deal.create({
        data: { userId: lead.userId, pipelineId: pipeline.id, leadId: lead.id, name: `${lead.firstName || lead.email} — ${lead.company || "New Lead"}`, value: 0, stage: dealStage },
      });
    }
  } catch (err) {
    console.error("Auto-create deal failed:", err);
  }

  return true;
}

export async function checkForReplies(userId: string) {
  const rawAccounts = await prisma.emailAccount.findMany({
    where: { userId, status: "active", deletedAt: null },
  });
  const accounts = rawAccounts.map(a => decryptAccount(a));

  let replied = 0;

  for (const account of accounts) {
    if (account.gmailToken) {
      replied += await checkGmailAccountReplies(account);
      // Mirror replies/follow-ups the user sent from their real email app so
      // Coldbox stays in sync with the actual conversation. Failure here must
      // never break the reply/bounce checks, so it's guarded separately.
      try { await recordGmailSentActivity(account); } catch (err: any) { console.error(`[sent] Gmail sent-scan failed for ${account.email}:`, err?.message || err); }
    } else if (account.imapHost && account.imapUser && account.imapPass) {
      replied += await checkImapAccountReplies(account);
      await checkImapAccountBounces(account);
      try { await recordImapSentActivity(account); } catch (err: any) { console.error(`[sent] IMAP sent-scan failed for ${account.email}:`, err?.message || err); }
    } else {
      console.log(`[reply] Skipping ${account.email}: no gmailToken and no IMAP creds`);
    }
  }

  return { replied };
}

// A sent message from the user's real email app/site that continues a
// conversation Coldpilot already tracks. `recordSentMessages` is the shared
// matching + insert core; `recordGmailSentActivity` and `recordImapSentActivity`
// feed it candidates from the Gmail SENT label / IMAP Sent folder.
type SentCandidate = {
  messageId: string;
  threadId?: string | null;
  inReplyTo: string;
  references: string;
  subject: string;
  to: string;
  body: string;
  date: Date;
};

// Matches the user's out-of-app sent messages to leads we already track and
// records them as outgoing email logs. Matching is strict: it only fires when
// the message's In-Reply-To/References reference a message-id we already have
// on file for this account (i.e. an existing campaign conversation). Dedup
// skips any message whose own message-id is already logged, so Coldpilot's own
// sends (campaign + Coldbox replies) are never double-recorded.
async function recordSentMessages(account: any, candidates: SentCandidate[]): Promise<number> {
  if (candidates.length === 0) return 0;

  const logs = await prisma.emailLog.findMany({
    where: {
      emailAccountId: account.id,
      messageId: { not: null },
    },
    select: { messageId: true, leadId: true, threadId: true },
    take: 10000,
  });

  const normId = (id: string) => id.replace(/[<>]/g, "").trim().toLowerCase();
  const idToLead = new Map<string, { leadId: string; threadId: string | null }>();
  const knownIds = new Set<string>();

  for (const log of logs) {
    if (!log.messageId) continue;
    const key = normId(log.messageId);
    knownIds.add(key);
    if (!idToLead.has(key)) {
      idToLead.set(key, { leadId: log.leadId, threadId: log.threadId });
    }
  }

  let recorded = 0;
  const seenThisBatch = new Set<string>();

  for (const c of candidates) {
    const cid = normId(c.messageId);
    if (!cid || knownIds.has(cid) || seenThisBatch.has(cid)) continue;

    // Match strictly via threading headers against known logs — a message only
    // counts if it continues a conversation we already track.
    const refText = `${c.inReplyTo || ""} ${c.references || ""}`;
    let match: { leadId: string; threadId: string | null } | null = null;
    const refTokens = refText.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g) || [];
    for (const tok of refTokens) {
      const hit = idToLead.get(normId(tok));
      if (hit) { match = hit; break; }
    }
    // Fallback: same substring scan the reply checkers use, for message-ids
    // whose local part contains characters our token regex skips.
    if (!match) {
      const refLower = refText.toLowerCase();
      for (const [key, val] of idToLead) {
        if (refLower.includes(key)) { match = val; break; }
      }
    }
    if (!match) continue;

    await prisma.emailLog.create({
      data: {
        leadId: match.leadId,
        emailAccountId: account.id,
        type: "outgoing",
        status: "sent",
        subject: c.subject || "No subject",
        bodyHtml: c.body || "",
        messageId: c.messageId,
        threadId: c.threadId || match.threadId || null,
        sentAt: c.date || new Date(),
      },
    });
    recorded++;
    seenThisBatch.add(cid);
  }

  if (recorded > 0) {
    console.log(`[sent] recorded ${recorded} out-of-app reply(ies) for ${account.email}`);
  }
  return recorded;
}

// Gmail accounts: list the SENT label and match against tracked threads.
async function recordGmailSentActivity(account: any): Promise<number> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.gmailToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 100,
    });
  } catch (err: any) {
    console.error(`[sent] Gmail sent-list failed for ${account.email}:`, err?.message || err);
    return 0;
  }
  const messages = listRes.data.messages || [];
  if (messages.length === 0) return 0;

  const candidates: SentCandidate[] = [];
  for (const m of messages) {
    if (!m.id) continue;
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
      const headers = full.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name)?.value || "";

      const messageId = getHeader("message-id").replace(/[<>]/g, "").trim();
      if (!messageId) continue;
      const from = getHeader("from");
      if (!from.toLowerCase().includes(account.email.toLowerCase())) continue;

      let body = "";
      const payload = full.data.payload;
      if (payload?.parts) {
        const textPart = payload.parts.find(p => p.mimeType === "text/plain")
          || payload.parts.find(p => p.mimeType === "text/html");
        if (textPart?.body?.data) body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
      } else if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, "base64url").toString("utf-8");
      }
      if (!body) body = full.data.snippet || "";

      const date = full.data.internalDate ? new Date(parseInt(full.data.internalDate, 10)) : new Date();

      candidates.push({
        messageId,
        threadId: full.data.threadId || null,
        inReplyTo: getHeader("in-reply-to"),
        references: getHeader("references"),
        subject: getHeader("subject"),
        to: getHeader("to"),
        body: cleanReplyBody(body.slice(0, 2000)),
        date,
      });
    } catch (err: any) {
      console.error(`[sent] Gmail message fetch failed for ${account.email} (${m.id}):`, err?.message || err);
    }
  }

  const recorded = await recordSentMessages(account, candidates);
  console.log(`[sent] Gmail scanned ${messages.length} sent messages for ${account.email}: ${candidates.length} candidates, ${recorded} recorded`);
  return recorded;
}

// IMAP accounts (Yahoo, Outlook, custom servers): scan the Sent folder with
// the same matching/insert core.
async function recordImapSentActivity(account: any): Promise<number> {
  // SSRF guard: imapHost/imapPort come from user-configured account settings,
  // so restrict to mail ports and reject private/reserved/metadata addresses.
  await assertSafeMailTarget(account.imapHost, account.imapPort || 993, "IMAP");
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort || 993,
    secure: (account.imapPort || 993) === 993,
    auth: { user: account.imapUser, pass: account.imapPass },
    logger: false,
  });

  try {
    await client.connect();
    const mailboxes = await client.list();
    let sentPath = "";
    for (const mb of mailboxes) {
      if (mb.specialUse === "\\Sent") { sentPath = mb.path; break; }
    }
    if (!sentPath) {
      const commonSentNames = ["sent", "sent items", "sent mail", "[gmail]/sent mail"];
      for (const mb of mailboxes) {
        const name = (mb.name || mb.path || "").toLowerCase();
        if (commonSentNames.includes(name) || commonSentNames.includes(mb.path.toLowerCase())) {
          sentPath = mb.path;
          break;
        }
      }
    }
    if (!sentPath) {
      console.log(`[sent] IMAP no Sent folder found for ${account.email}`);
      return 0;
    }

    const lock = await client.getMailboxLock(sentPath);
    const candidates: SentCandidate[] = [];
    let scannedCount = 0;
    try {
      // Search with { uid: true } to get real UIDs (Gmail's UIDs are not
      // contiguous with sequence numbers when messages are deleted) so the
      // cursor comparison is valid. The cursor skips already-seen messages,
      // making this scan cheap even on a large Sent folder.
      const allUids = (await client.search({}, { uid: true })) || [];
      const maxUid = allUids.length ? allUids[allUids.length - 1] : 0;
      const lastUid = account.lastSentUid || 0;
      let uids: number[] = allUids;
      if (lastUid > 0) {
        // If the folder was rebuilt (UIDVALIDITY change), uids drop below the
        // cursor — rescan from scratch. Otherwise only new messages.
        uids = maxUid < lastUid ? allUids : allUids.filter(u => u > lastUid);
      }
      scannedCount = uids.length;
      let cursorUid = lastUid;
      for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
        if (!msg.source) continue;
        let parsed;
        try {
          parsed = await simpleParser(msg.source);
        } catch {
          continue;
        }
        if (msg.uid && msg.uid > cursorUid) cursorUid = msg.uid;
        const from = parsed.from?.text || "";
        if (!from.toLowerCase().includes(account.email.toLowerCase())) continue;
        const messageId = (parsed.messageId || "").replace(/[<>]/g, "").trim();
        if (!messageId) continue;
        const references = Array.isArray(parsed.references)
          ? parsed.references.join(" ")
          : (parsed.references || "");
        const toText = Array.isArray(parsed.to)
          ? parsed.to.map(t => t.text).join(", ")
          : (parsed.to?.text || "");
        candidates.push({
          messageId,
          inReplyTo: parsed.inReplyTo || "",
          references,
          subject: parsed.subject || "",
          to: toText,
          body: cleanReplyBody((parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ") : "") || "").slice(0, 2000)),
          date: parsed.date || new Date(),
        });
      }
      if (cursorUid > lastUid) {
        await prisma.emailAccount.update({
          where: { id: account.id },
          data: { lastSentUid: cursorUid },
        });
      }
    } finally {
      lock.release();
    }

    const recorded = await recordSentMessages(account, candidates);
    console.log(`[sent] IMAP scanned ${scannedCount} sent messages for ${account.email}: ${candidates.length} candidates, ${recorded} recorded`);
    return recorded;
  } catch (err: any) {
    console.error(`[sent] IMAP sent-scan failed for ${account.email}:`, err?.message || err);
    return 0;
  } finally {
    try { await client.logout(); } catch {}
  }
}

// Yahoo (and several other providers) accept a message at SMTP time with a
// "250 OK" even for an address that doesn't actually exist, then deliver a
// bounce notification email back to the sender's own inbox later, from an
// address like mailer-daemon or postmaster. The SMTP-time bounce handling in
// send.ts can never catch these, since as far as the SMTP transaction is
// concerned, nothing went wrong. This scans the inbox for those notification
// emails, extracts which recipient actually failed, and applies the same
// suppression logic as an SMTP-time hard bounce would.
async function checkImapAccountBounces(account: any): Promise<number> {
  let bounced = 0;

  // SSRF guard: imapHost/imapPort come from user-configured account settings,
  // so restrict to mail ports and reject private/reserved/metadata addresses.
  await assertSafeMailTarget(account.imapHost, account.imapPort || 993, "IMAP");
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort || 993,
    secure: (account.imapPort || 993) === 993,
    auth: { user: account.imapUser, pass: account.imapPass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allUids = (await client.search({ since }) || []);
      const uids = allUids.slice(-1000);

      const bounceSenderPattern = /mailer-daemon|postmaster|mail delivery subsystem|mail-delivery|no-?reply.*delivery|delivery.*status.*notification/i;
      let bounceCandidates = 0;

      for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
        const rawSource = msg.source?.toString() || "";
        if (!rawSource) continue;

        const headerEnd = rawSource.indexOf("\r\n\r\n");
        const headerBlock = headerEnd >= 0 ? rawSource.slice(0, headerEnd) : rawSource;
        const headerLines = headerBlock.split(/\r?\n/);
        const headers: Record<string, string> = {};
        let currentKey = "";
        for (const line of headerLines) {
          if (/^\s/.test(line) && currentKey) {
            headers[currentKey] += " " + line.trim();
          } else {
            const colonIdx = line.indexOf(":");
            if (colonIdx > 0) {
              currentKey = line.slice(0, colonIdx).toLowerCase().trim();
              headers[currentKey] = line.slice(colonIdx + 1).trim();
            }
          }
        }

        const from = headers["from"] || "";
        const subject = headers["subject"] || "";
        const looksLikeBounce = bounceSenderPattern.test(from) || bounceSenderPattern.test(subject) ||
          /undeliverable|delivery.?(status|has).?fail|returned.?mail|failure.?notice/i.test(subject);
        if (!looksLikeBounce) continue;

        bounceCandidates++;
        const body = headerEnd >= 0 ? rawSource.slice(headerEnd + 4) : "";

        // Try to find the failed recipient. DSN-compliant bounces include a
        // "Final-Recipient:" header inside the message/delivery-status part;
        // non-DSN bounces (common with Yahoo/AOL-style notifications) just
        // mention the address in plain text. Try both.
        let failedRecipient = "";
        const finalRecipMatch = body.match(/Final-Recipient:\s*(?:rfc822;)?\s*([\w.+-]+@[\w.-]+\.\w+)/i);
        if (finalRecipMatch) {
          failedRecipient = finalRecipMatch[1].toLowerCase();
        } else {
          // Fall back to scanning the plain-text body for an email address
          // near common bounce phrasing.
          const textNearFailure = body.match(/(?:following address(?:es)? failed|undeliverable to|delivery failed for|error for)[^\n]*?([\w.+-]+@[\w.-]+\.\w+)/i);
          if (textNearFailure) failedRecipient = textNearFailure[1].toLowerCase();
        }
        if (!failedRecipient) {
          console.log(`[bounce] IMAP: bounce-looking message from ${from} subject="${subject}" but couldn't extract a recipient address`);
          continue;
        }

        // Only act on this if it's actually a lead we sent to and haven't
        // already flagged as bounced/suppressed.
        const lead = await prisma.lead.findFirst({
          where: { email: failedRecipient, userId: account.userId },
        });
        if (!lead) {
          console.log(`[bounce] IMAP: ${failedRecipient} not found as a lead`);
          continue;
        }

        // Phantom guard: a bounce-looking email mentioning a lead is not
        // proof WE were mailing them (forwards, threads, newsletters from
        // postmaster-like senders). Require an actual outgoing send to this
        // lead in the last 14 days, or the "bounce" is unrelated noise.
        const recentSend = await prisma.emailLog.findFirst({
          where: {
            leadId: lead.id,
            type: "outgoing",
            status: "sent",
            sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          },
          select: { id: true },
        });
        if (!recentSend) {
          console.log(`[bounce] IMAP: ${failedRecipient} has no recent outgoing send — ignoring`);
          continue;
        }

        const alreadySuppressed = await prisma.suppression.findUnique({
          where: { userId_email: { userId: account.userId, email: failedRecipient } },
        });
        if (alreadySuppressed) {
          console.log(`[bounce] IMAP: ${failedRecipient} already suppressed`);
          continue;
        }

        // Reuse the same categorization logic as SMTP-time bounces, just fed
        // with the bounce notification's text instead of a thrown error.
        const bounce = categorizeBounce({ message: body.slice(0, 4000) });
        console.log(`[bounce] IMAP matched bounce for ${failedRecipient}: ${bounce.type} (suppress=${bounce.suppress})`);

        // Act ONLY on suppressing verdicts. Non-suppressing results
        // (soft/connection/auth/unknown) previously fell through into
        // recordBounce + lead-bounced + notifications — manufacturing phantom
        // bounces, phantom alerts, and poisoned domain reputation out of
        // unrelated mailbox noise.
        if (!bounce.suppress) {
          console.log(`[bounce] IMAP: ${failedRecipient} non-suppressing (${bounce.type}) — logged only`);
          continue;
        }

        await prisma.suppression.upsert({
          where: { userId_email: { userId: account.userId, email: failedRecipient } },
          update: {},
          create: { userId: account.userId, email: failedRecipient, reason: bounce.type, type: "bounce" },
        });
        recordBounce(failedRecipient, null, bounce.type, bounce.type, account.id, lead.id).catch(() => {});
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "bounced" } }).catch(() => {});
        createNotification({
          userId: account.userId,
          type: "bounce",
          title: "Email bounced",
          message: `${failedRecipient} — ${bounce.type}`,
        }).catch(() => {});
        dispatchWebhookEvent({ event: "bounce", userId: account.userId, data: { email: failedRecipient, reason: bounce.type } }).catch(() => {});
        bounced++;
      }
      console.log(`[bounce] IMAP done for ${account.email}: candidates=${bounceCandidates} bounced=${bounced}`);
    } finally {
      lock.release();
    }
  } catch (err: any) {
    console.error(`[bounce] IMAP check failed for ${account.email}:`, err?.message || err);
  } finally {
    try { await client.logout(); } catch {}
  }

  return bounced;
}

async function checkGmailAccountReplies(account: any): Promise<number> {
  let replied = 0;

  const sentLogs = await prisma.emailLog.findMany({
    where: {
      emailAccountId: account.id,
      type: "outgoing",
      repliedAt: null,
    },
    select: { threadId: true, id: true, leadId: true, messageId: true, subject: true, lead: { select: { email: true } } },
    orderBy: { sentAt: "desc" },
    take: 1000,
  });

  // Maps a lead's email address -> leadId, used by the spam-scan's
  // sender+subject fallback matcher (mirrors the IMAP path).
  const leadEmailById = new Map<string, string>();
  for (const l of sentLogs) {
    if (l.lead?.email) leadEmailById.set(l.lead.email.toLowerCase(), l.leadId);
  }

  console.log(`[reply] Gmail check for ${account.email}: ${sentLogs.length} pending logs`);

  let authFailed = false;
  const processedLeadIds = new Set<string>();

  for (const log of sentLogs) {
    if (!log.threadId) continue;
    if (processedLeadIds.has(log.leadId)) continue;
    try {
      const threadResult = await checkGmailThread(account.gmailToken, log.threadId, account.email);
      if (threadResult) {
        const ok = await processReply(log, account, threadResult.subject, threadResult.body, threadResult.messageId);
        processedLeadIds.add(log.leadId);
        if (ok) replied++;
      }
    } catch (err: any) {
      // An expired/revoked refresh token fails the same way for every thread
      // in this account and was previously only ever logged to the server
      // console, so the user had no way of knowing reply detection had
      // silently stopped working. Surface it on the account and stop
      // burning through the rest of this account's threads on the same
      // dead token.
      const isAuthFailure = err?.code === 401 || err?.code === "EAUTH" ||
        (typeof err?.message === "string" && (err.message.includes("invalid_grant") || err.message.includes("invalid_token")));
      if (isAuthFailure) {
        authFailed = true;
        console.error(`Gmail auth failed for ${account.email}, marking account as needing reconnection:`, err?.message || err);
        try {
          await prisma.emailAccount.update({ where: { id: account.id }, data: { status: "error" } });
        } catch {}
        createNotification({
          userId: account.userId,
          type: "account_error",
          title: "Reconnect your email account",
          message: `${account.email} needs to be reconnected — reply detection has stopped working for it.`,
        }).catch(() => {});
        // Send account disconnected email
        const acctUser = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
        if (acctUser?.email) sendEmailSafe(acctUser.email, "account-disconnected");
        break;
      }
      console.error(`Gmail reply check failed for thread ${log.threadId}:`, err);
    }
  }

  // Also scan the SPAM label — Gmail usually keeps a reply in the same
  // thread as the original send even if it's classified as spam, but that
  // isn't guaranteed (e.g. a reply from an address Gmail doesn't trust yet
  // can start a separate, spam-labeled thread). This mirrors the IMAP
  // spam-folder scanning above: same header + subject/sender fallback
  // matching, and any match gets moved out of SPAM into the inbox.
  if (!authFailed) {
    try {
      replied += await checkGmailSpamReplies(account, sentLogs, leadEmailById);
    } catch (err: any) {
      console.error(`[reply] Gmail spam scan failed for ${account.email}:`, err?.message || err);
    }
  }

  return replied;
}

async function checkGmailSpamReplies(
  account: any,
  sentLogs: { id: string; leadId: string; threadId: string | null; messageId: string | null; subject: string | null; lead?: { email: string | null } }[],
  leadEmailById: Map<string, string>
): Promise<number> {
  if (sentLogs.length === 0) return 0;

  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.gmailToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SPAM"],
    maxResults: 50,
    q: "-label:inbox",
  });
  const messages = listRes.data.messages || [];
  if (messages.length === 0) return 0;

  console.log(`[reply] Gmail SPAM: ${messages.length} messages in last 7 days for ${account.email}`);

  const normId = (id: string) => id.replace(/[<>]/g, "").trim();
  const normSubject = (s: string) => { let r = s.trim().toLowerCase(); while (/^(re|fwd?|fw)\s*:\s*/i.test(r)) r = r.replace(/^(re|fwd?|fw)\s*:\s*/i, ""); return r; };

  let replied = 0;

  for (const m of messages) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    const headers = full.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name)?.value || "";

    const from = getHeader("from");
    if (from.toLowerCase().includes(account.email.toLowerCase())) continue;

    const inReplyTo = getHeader("in-reply-to");
    const references = getHeader("references");
    const replySubject = getHeader("subject");

    let matchedLog: typeof sentLogs[number] | undefined;
    if (inReplyTo || references) {
      matchedLog = sentLogs.find(l =>
        l.messageId && (inReplyTo.includes(normId(l.messageId)) || references.includes(normId(l.messageId)))
      );
    }
    // Fallback: match on sender + normalized subject when threading headers
    // are missing or don't line up with our records.
    if (!matchedLog && replySubject) {
      const fromEmailMatch = from.match(/<?([\w.+-]+@[\w.-]+\.\w+)>?/);
      const fromEmail = fromEmailMatch ? fromEmailMatch[1].toLowerCase() : "";
      if (fromEmail) {
        const normReplySubject = normSubject(replySubject);
        matchedLog = sentLogs.find(l =>
          l.lead?.email?.toLowerCase() === fromEmail && l.subject && normSubject(l.subject) === normReplySubject
        );
      }
    }
    if (!matchedLog) continue;

    let body = "";
    const payload = full.data.payload;
    if (payload?.parts) {
      const textPart = payload.parts.find(p => p.mimeType === "text/plain")
        || payload.parts.find(p => p.mimeType === "text/html");
      if (textPart?.body?.data) body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    } else if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }
    if (!body) body = full.data.snippet || "";

    console.log(`[reply] Gmail SPAM matched reply to log ${matchedLog.id} from ${from}`);
    const spamMessageId = getHeader("message-id");
    const ok = await processReply(
      { id: matchedLog.id, leadId: matchedLog.leadId, threadId: matchedLog.threadId || full.data.threadId || null },
      account,
      replySubject,
      cleanReplyBody(body.slice(0, 2000)),
      spamMessageId ? spamMessageId.replace(/[<>]/g, "").trim() : null,
    );
    if (ok) {
      replied++;
      // Move it out of spam and into the inbox now that it's been detected.
      try {
        await gmail.users.messages.modify({ userId: "me", id: m.id, requestBody: { removeLabelIds: ["SPAM"], addLabelIds: ["INBOX"] } });
        console.log(`[reply] Moved Gmail message ${m.id} out of SPAM to INBOX for ${account.email}`);
      } catch (modErr: any) {
        console.error(`[reply] Failed to un-spam Gmail message ${m.id} for ${account.email}:`, modErr?.message || modErr);
      }
    }
  }

  return replied;
}

async function checkGmailThread(refreshToken: string, threadId: string, ownEmail: string): Promise<{ subject: string; body: string; messageId: string | null } | null> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = res.data.messages || [];
  for (let i = messages.length - 1; i >= 1; i--) {
    const msg = messages[i];
    const headers = msg.payload?.headers || [];
    const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "";
    if (from.toLowerCase().includes(ownEmail.toLowerCase())) continue;
    const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "";
    const rawMessageId = headers.find(h => h.name?.toLowerCase() === "message-id")?.value || "";
    const messageId = rawMessageId ? rawMessageId.replace(/[<>]/g, "").trim() : null;

    // Extract full body from MIME parts instead of relying on snippet
    let body = "";
    if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find(p => p.mimeType === "text/plain")
        || msg.payload.parts.find(p => p.mimeType === "text/html");
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
      }
    } else if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, "base64url").toString("utf-8");
    }
    if (!body) body = msg.snippet || "";

    return { subject, body: cleanReplyBody(body.slice(0, 2000)), messageId };
  }
  return null;
}

async function checkImapAccountReplies(account: any): Promise<number> {
  let replied = 0;

  const sentLogs = await prisma.emailLog.findMany({
    where: {
      emailAccountId: account.id,
      type: "outgoing",
      repliedAt: null,
    },
    select: { id: true, leadId: true, messageId: true, threadId: true, subject: true, lead: { select: { email: true } } },
    take: 1000,
  });

  if (sentLogs.length === 0) return 0;

  // Maps a lead's email address -> leadId, used by the subject/sender
  // fallback matcher below for replies that don't carry In-Reply-To/References.
  const leadEmailById = new Map<string, string>();
  for (const l of sentLogs) {
    if (l.lead?.email) leadEmailById.set(l.lead.email.toLowerCase(), l.leadId);
  }

  console.log(`[reply] IMAP check for ${account.email}: ${sentLogs.length} pending logs`);

  // SSRF guard: imapHost/imapPort come from user-configured account settings,
  // so restrict to mail ports and reject private/reserved/metadata addresses.
  await assertSafeMailTarget(account.imapHost, account.imapPort || 993, "IMAP");
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort || 993,
    secure: (account.imapPort || 993) === 993,
    auth: { user: account.imapUser, pass: account.imapPass },
    logger: false,
  });

  // Scans a single mailbox for replies. When `isSpam` is true and a reply is
  // found, the message is moved into INBOX after being recorded — so a reply
  // that landed in spam (common with Yahoo, and with any brand-new sending
  // account) still gets detected AND surfaced where the person will actually
  // see it in their real inbox.
  async function scanMailbox(mailboxPath: string, isSpam: boolean): Promise<number> {
    let foundHere = 0;
    let lock;
    try {
      lock = await client.getMailboxLock(mailboxPath);
    } catch (err: any) {
      console.log(`[reply] IMAP could not open mailbox "${mailboxPath}" for ${account.email}: ${err?.message || err}`);
      return 0;
    }
    try {
      const allUids = (await client.search({})) || [];
      const uids = allUids.slice(-1000);
      console.log(`[reply] IMAP ${mailboxPath}: ${uids.length} messages`);

      let checkedCount = 0;
      let matchAttempts = 0;

      // We fetch the raw source and hand it to mailparser's simpleParser,
      // which properly decodes multipart/MIME messages (base64,
      // quoted-printable, nested boundaries, etc). The previous approach
      // parsed headers with regex and grabbed the body with a fragile
      // regex match — it worked for simple plain-text emails but leaked
      // raw MIME boundary markers and base64 payloads into the reply body
      // for anything multipart (which is most real-world mail clients).
      for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
        checkedCount++;
        if (!msg.source) continue;

        let parsed;
        try {
          parsed = await simpleParser(msg.source);
        } catch (parseErr: any) {
          console.error(`[reply] Failed to parse MIME message uid ${msg.uid} for ${account.email}:`, parseErr?.message || parseErr);
          continue;
        }

        const from = parsed.from?.text || "";
        if (from.toLowerCase().includes(account.email.toLowerCase())) continue;

        const inReplyTo = parsed.inReplyTo || "";
        const references = Array.isArray(parsed.references)
          ? parsed.references.join(" ")
          : (parsed.references || "");
        const replySubject = parsed.subject || "";
        // Normalize angle brackets for matching
        const normId = (id: string) => id.replace(/[<>]/g, "").trim();
        const normSubject = (s: string) => { let r = s.trim().toLowerCase(); while (/^(re|fwd?|fw)\s*:\s*/i.test(r)) r = r.replace(/^(re|fwd?|fw)\s*:\s*/i, ""); return r; };

        let matchedLog: typeof sentLogs[number] | undefined;
        let matchMethod = "";

        if (inReplyTo || references) {
          matchAttempts++;
          matchedLog = sentLogs.find(l =>
            l.messageId && (
              inReplyTo.includes(normId(l.messageId)) || references.includes(normId(l.messageId))
            )
          );
          if (matchedLog) matchMethod = "headers";
        }

        // Fallback: some mail clients (mobile apps, some webmail, forwarded
        // threads) don't preserve In-Reply-To/References at all. Previously
        // any reply lacking those headers was skipped outright with no
        // further check. As a fallback, match on sender + normalized subject
        // (stripping Re:/Fwd: prefixes) against our sent logs — this is
        // weaker evidence than header matching, so it only fires when the
        // sender's address matches a lead we actually emailed.
        if (!matchedLog && replySubject) {
          const fromEmailMatch = from.match(/<?([\w.+-]+@[\w.-]+\.\w+)>?/);
          const fromEmail = fromEmailMatch ? fromEmailMatch[1].toLowerCase() : "";
          if (fromEmail) {
            const normReplySubject = normSubject(replySubject);
            // Match across ALL leads with this email (may span multiple campaigns)
            matchedLog = sentLogs.find(l =>
              l.lead?.email?.toLowerCase() === fromEmail &&
              l.subject && normSubject(l.subject) === normReplySubject
            );
            if (matchedLog) matchMethod = "subject+sender";
          }
        }

        if (!matchedLog) {
          continue;
        }

        // Extract body — prefer mailparser's decoded plain-text part; fall
        // back to the decoded HTML part (tags stripped) if no text/plain
        // part exists. Both are already fully MIME-decoded at this point.
        const decodedBody = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ") : "") || "";
        // Clean up the reply body: strip MIME headers, quoted text, and
        // the "On ... wrote:" introduction line so only the actual reply
        // content is shown.
        const replyBody = decodedBody ? cleanReplyBody(decodedBody.slice(0, 2000)) : "";

        console.log(`[reply] IMAP matched reply to log ${matchedLog.id} from ${from} in "${mailboxPath}" (method: ${matchMethod})`);
        const imapMessageId = parsed.messageId || "";
        const ok = await processReply(
          { id: matchedLog.id, leadId: matchedLog.leadId, threadId: matchedLog.threadId || msg.uid?.toString() || null },
          account,
          replySubject,
          replyBody,
          imapMessageId ? imapMessageId.replace(/[<>]/g, "").trim() : null,
        );
        if (ok) {
          foundHere++;
          // Move the reply out of spam and into the real inbox now that
          // it's been detected, so the person actually sees it there too.
          if (isSpam && msg.uid) {
            try {
              await client.messageMove([msg.uid], "INBOX", { uid: true });
              console.log(`[reply] Moved message uid ${msg.uid} from "${mailboxPath}" to INBOX for ${account.email}`);
            } catch (moveErr: any) {
              console.error(`[reply] Failed to move message out of "${mailboxPath}" for ${account.email}:`, moveErr?.message || moveErr);
            }
          }
        }
      }

      console.log(`[reply] IMAP ${mailboxPath} done: checked=${checkedCount} withReplyHeaders=${matchAttempts} replied=${foundHere}`);
    } finally {
      lock.release();
    }
    return foundHere;
  }

  try {
    await client.connect();

    replied += await scanMailbox("INBOX", false);

    // Find spam/junk folders. Most providers (including Yahoo) expose the
    // IMAP SPECIAL-USE extension so the \Junk flag reliably identifies the
    // right folder regardless of its display name/language. Fall back to
    // common folder names for servers that don't support SPECIAL-USE.
    try {
      const mailboxes = await client.list();
      const junkPaths = new Set<string>();
      for (const mb of mailboxes) {
        if (mb.specialUse === "\\Junk") junkPaths.add(mb.path);
      }
      if (junkPaths.size === 0) {
        const commonJunkNames = ["spam", "junk", "junk e-mail", "bulk mail", "bulk", "[gmail]/spam"];
        for (const mb of mailboxes) {
          const name = (mb.name || mb.path || "").toLowerCase();
          if (commonJunkNames.includes(name) || commonJunkNames.includes(mb.path.toLowerCase())) {
            junkPaths.add(mb.path);
          }
        }
      }
      for (const jp of junkPaths) {
        replied += await scanMailbox(jp, true);
      }
    } catch (listErr: any) {
      console.error(`[reply] IMAP could not list mailboxes for ${account.email}:`, listErr?.message || listErr);
    }
  } catch (err: any) {
    console.error(`[reply] IMAP failed for ${account.email}:`, err?.message || err);
    // This used to be console-only, so a bad IMAP password or a provider that
    // needs an app-specific password (Yahoo requires one, and requires IMAP
    // access to be separately enabled) would silently and permanently break
    // reply detection with zero visibility in the app.
    const msg = (err?.message || "").toLowerCase();
    const authFailed = err?.authenticationFailed || msg.includes("auth") || msg.includes("login") || msg.includes("invalid credentials");
    if (authFailed) {
      try {
        await prisma.emailAccount.update({ where: { id: account.id }, data: { status: "error" } });
      } catch {}
      createNotification({
        userId: account.userId,
        type: "account_error",
        title: "Reconnect your email account",
        message: `${account.email} failed to connect over IMAP — reply detection has stopped working for it. If this is Yahoo, Outlook, or another provider that requires an app-specific password, make sure IMAP access is enabled and you're using an app password, not your regular login password.`,
      }).catch(() => {});
      // Send account disconnected email
      const imapUser = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
      if (imapUser?.email) sendEmailSafe(imapUser.email, "account-disconnected");
    }
  } finally {
    try { await client.logout(); } catch {}
  }

  return replied;
}

export async function sendDailySummaries() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usersWithIntegrations = await prisma.integration.findMany({
    where: { active: true, provider: "slack" },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of usersWithIntegrations) {
    try {
      const accountIds = (await prisma.emailAccount.findMany({
        where: { userId, deletedAt: null },
        select: { id: true },
      })).map(a => a.id);

      const sent = await prisma.emailLog.count({
        where: { emailAccountId: { in: accountIds }, type: "outgoing", sentAt: { gte: today } },
      });
      const replies = await prisma.emailLog.count({
        where: { emailAccountId: { in: accountIds }, type: "incoming", sentAt: { gte: today } },
      });
      const bounces = await prisma.emailLog.count({
        where: { emailAccountId: { in: accountIds }, type: "outgoing", sentAt: { gte: today }, bounceCategory: { not: null } },
      });

      dispatchIntegrationEvent(userId, "daily_summary", { sent, replies, bounces }).catch(() => {});
    } catch (err) {
      console.error(`[daily-summary] failed for user ${userId}:`, err);
    }
  }
}
