import { prisma } from "@/lib/prisma";
import { sendEmail } from "./send";
import { personalizeText } from "./personalize";
import { createNotification } from "@/lib/notify";
import { dispatchWebhookEvent } from "@/lib/webhook";
import { dispatchIntegrationEvent } from "@/integrations";
import { classifyReply } from "@/lib/classify";
import { categorizeBounce } from "@/lib/bounce";
import { getCalendlyLink } from "@/integrations/calendly";
import { ImapFlow } from "imapflow";

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

// Track last send time per campaign across ticks
const lastSendTimeByCampaign = new Map<string, number>();

export async function executeCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { order: "asc" } },
      schedules: true,
    },
  });

  if (!campaign || campaign.status !== "active") return { sent: 0, errors: 0, skipped: 0 };

  if (!isWithinSchedule(campaign)) return { sent: 0, errors: 0, skipped: 0, reason: "outside_schedule" };

  // Use selected account IDs if set, otherwise use all active accounts
  let selectedIds: string[] = [];
  try { selectedIds = campaign.accountIds ? JSON.parse(campaign.accountIds) : []; } catch {}

  const accounts = await prisma.emailAccount.findMany({
    where: {
      userId: campaign.userId,
      status: "active",
      ...(selectedIds.length > 0 ? { id: { in: selectedIds } } : {}),
    },
  });
  if (accounts.length === 0) return { sent: 0, errors: 0, reason: "no_accounts" };

  const calendlyLink = await getCalendlyLink(campaign.userId);

  // Get all leads for this campaign — pending (unsent), sent (awaiting follow-up), or active
  // Leads that have replied are excluded via status filter ("replied" not in ["pending", "sent"])
  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: { in: ["pending", "sent"] },
    },
  });

  const emailSteps = campaign.steps.filter(s => s.type === "email");
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

  const minGap = (campaign.minTimeBetween || 0) * 60 * 1000;
  const maxExtra = (campaign.randomExtraTime || 0) * 60 * 1000;

  // Slow ramp: start at 1/day, +2 each day
  let campaignCap = campaign.dailySendLimit || 30;
  if (campaign.slowRamp && campaign.rampStart) {
    const daysSince = Math.floor((Date.now() - new Date(campaign.rampStart).getTime()) / 86400000);
    campaignCap = Math.min(1 + daysSince * 2, campaignCap);
  }

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
    where: { campaignId, status: { in: ["pending", "sent"] } },
  });

  for (const lead of updatedLeads) {
    const account = accounts.find(a => a.id === lead.sendingAccountId) || accounts[emailCount % accounts.length];
    const currentStepIdx = lead.currentStep || 0;
    const step = emailSteps[currentStepIdx];

    if (!step) {
      // All steps completed — mark lead as done
      if (lead.status === "sent") {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "completed" } });
      }
      continue;
    }

    // Daily cap check (includes emails sent in previous ticks today)
    if (todaySent + emailCount >= campaignCap) { skipped++; continue; }

    // Time gap pacing — persists across ticks via shared Map
    const lastTick = lastSendTimeByCampaign.get(campaignId) || 0;
    if (lastTick > 0) {
      const gap = minGap + (maxExtra > 0 ? Math.random() * maxExtra : 0);
      if (Date.now() - lastTick < gap) { skipped++; continue; }
    }

    // Phase 1: Send initial email to pending leads
    if (lead.status === "pending" && currentStepIdx === 0) {
      // Atomically claim this lead — prevents duplicate sends from concurrent ticks
      const claimResult = await prisma.lead.updateMany({
        where: { id: lead.id, status: "pending", currentStep: 0 },
        data: { status: "sent", currentStep: 1, lastSentAt: new Date() },
      });
      if (claimResult.count === 0) { skipped++; continue; }

      try {
        const accountSignature = (account as any)?.signature || "";
        const vars = {
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
          calendlyLink: "",
        };

        let subject: string;
        let htmlBody: string;
        subject = personalizeText(step.subject || "Hello", vars);
        htmlBody = personalizeText(step.bodyHtml || "", vars);

        if (calendlyLink) {
          subject = subject.replace(/\{\{calendlyLink\}\}/g, calendlyLink);
          htmlBody = htmlBody.replace(/\{\{calendlyLink\}\}/g, calendlyLink);
        }

        await sendEmail({
          to: lead.email,
          subject,
          htmlBody,
          emailAccountId: account.id,
          leadId: lead.id,
          campaignStepId: step.id,
          trackingId: lead.id,
          openTracking: campaign.openTracking,
          clickTracking: campaign.clickTracking,
        });

        sent++;
        emailCount++;
        lastSendTimeByCampaign.set(campaignId, Date.now());
      } catch (err: any) {
        console.error(`Failed to send initial to ${lead.email}:`, err);
        const bounce = categorizeBounce(err);
        if (bounce.suppress) {
          await prisma.suppression.upsert({
            where: { userId_email: { userId: campaign.userId, email: lead.email.toLowerCase().trim() } },
            create: { userId: campaign.userId, email: lead.email.toLowerCase().trim(), reason: bounce.type, type: "bounce" },
            update: {},
          });
          createNotification({
            userId: campaign.userId,
            type: "bounce",
            title: "Email Bounced",
            message: `${lead.email} — ${bounce.type}`,
          }).catch(() => {});
          dispatchWebhookEvent({ event: "bounce", userId: campaign.userId, data: { leadId: lead.id, email: lead.email, reason: bounce.type } }).catch(() => {});
        }
        // Roll back optimistic claim so the lead can be retried
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "pending", currentStep: 0, lastSentAt: null },
        });
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

      // Atomically claim this follow-up — prevents duplicate sends
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

      try {
        // Send as reply to thread (for threading)
        const lastLog = await prisma.emailLog.findFirst({
          where: { leadId: lead.id, type: "outgoing" },
          orderBy: { sentAt: "desc" },
        });

        let fupSubject = step.subject || "Re: Your conversation with Coldpilot";
        let fupBody = step.bodyHtml || "";
        const fupVars = {
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
          calendlyLink: "",
        };
        fupSubject = personalizeText(fupSubject, fupVars);
        fupBody = personalizeText(fupBody, fupVars);
        if (calendlyLink) {
          fupSubject = fupSubject.replace(/\{\{calendlyLink\}\}/g, calendlyLink);
          fupBody = fupBody.replace(/\{\{calendlyLink\}\}/g, calendlyLink);
        }

        await sendEmail({
          to: lead.email,
          subject: fupSubject,
          htmlBody: fupBody,
          emailAccountId: account.id,
          leadId: lead.id,
          campaignStepId: step.id,
          trackingId: lead.id,
          openTracking: campaign.openTracking,
          clickTracking: campaign.clickTracking,
          threadId: lastLog?.threadId || undefined,
          inReplyTo: lastLog?.messageId || null,
        });

        sent++;
        emailCount++;
        lastSendTimeByCampaign.set(campaignId, Date.now());
      } catch (err: any) {
        console.error(`Failed to send follow-up to ${lead.email}:`, err);
        const bounce = categorizeBounce(err);
        if (bounce.suppress) {
          await prisma.suppression.upsert({
            where: { userId_email: { userId: campaign.userId, email: lead.email.toLowerCase().trim() } },
            create: { userId: campaign.userId, email: lead.email.toLowerCase().trim(), reason: bounce.type, type: "bounce" },
            update: {},
          });
          createNotification({
            userId: campaign.userId,
            type: "bounce",
            title: "Email Bounced",
            message: `${lead.email} — ${bounce.type}`,
          }).catch(() => {});
          dispatchWebhookEvent({ event: "bounce", userId: campaign.userId, data: { leadId: lead.id, email: lead.email, reason: bounce.type } }).catch(() => {});
        }
        // Roll back the optimistic claim so the lead can be retried
        await prisma.lead.update({
          where: { id: lead.id },
          data: { currentStep: currentStepIdx, status: "sent", lastSentAt: null },
        });
        errors++;
      }
    }
  }

  return { sent, errors, skipped };
}

async function processReply(
  log: { id: string; leadId: string; threadId: string | null },
  account: { id: string; email: string },
  replySubject: string,
  replyBody: string,
): Promise<boolean> {
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
      bodyHtml: replyBody,
      threadId: log.threadId,
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
  const accounts = await prisma.emailAccount.findMany({
    where: { userId, status: "active" },
  });

  let replied = 0;

  for (const account of accounts) {
    if (account.gmailToken) {
      replied += await checkGmailAccountReplies(account);
    } else if (account.imapHost && account.imapUser && account.imapPass) {
      replied += await checkImapAccountReplies(account);
    }
  }

  return { replied };
}

async function checkGmailAccountReplies(account: any): Promise<number> {
  let replied = 0;

  const sentLogs = await prisma.emailLog.findMany({
    where: {
      emailAccountId: account.id,
      type: "outgoing",
      repliedAt: null,
      threadId: { not: null },
    },
    select: { threadId: true, id: true, leadId: true },
    take: 50,
  });

  for (const log of sentLogs) {
    if (!log.threadId) continue;
    try {
      const threadResult = await checkGmailThread(account.gmailToken, log.threadId, account.email);
      if (threadResult) {
        const ok = await processReply(log, account, threadResult.subject, threadResult.body);
        if (ok) replied++;
      }
    } catch (err) {
      console.error(`Gmail reply check failed for thread ${log.threadId}:`, err);
    }
  }

  return replied;
}

async function checkGmailThread(refreshToken: string, threadId: string, ownEmail: string): Promise<{ subject: string; body: string } | null> {
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

    return { subject, body: body.slice(0, 2000) };
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
      messageId: { not: null },
    },
    select: { id: true, leadId: true, messageId: true, threadId: true, subject: true },
    take: 50,
  });

  if (sentLogs.length === 0) return 0;

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
      // Search for messages received in the last 7 days (limit to 200 for performance)
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allUids = (await client.search({ since }) || []);
      const uids = allUids.slice(-200);

      for await (const msg of client.fetch(uids, { headers: true, source: true })) {
        const hdrs: Map<string, string> | undefined = msg.headers as any;
        if (!hdrs) continue;
        const from = (hdrs.get("from") || "") as string;
        if (from.toLowerCase().includes(account.email.toLowerCase())) continue;

        const inReplyTo = (hdrs.get("in-reply-to") || "") as string;
        const references = (hdrs.get("references") || "") as string;
        const replySubject = (hdrs.get("subject") || "") as string;
        const rawSource = msg.source?.toString() || "";
        // Extract body: find first double-newline after headers, skip MIME parts
        let replyBody = "";
        const bodyStart = rawSource.indexOf("\n\n");
        if (bodyStart >= 0) {
          const afterHeaders = rawSource.slice(bodyStart + 2);
          // Try to find text/plain content between MIME boundaries
          const textMatch = afterHeaders.match(/Content-Type:\s*text\/plain[^]*?\n\n([^]*?)(?:\n--|\n\.\n|$)/i);
          if (textMatch && textMatch[1]) {
            replyBody = textMatch[1].trim().slice(0, 2000);
          } else {
            // Fallback: take content after double newline, strip HTML tags
            replyBody = afterHeaders.replace(/<[^>]*>/g, "").trim().slice(0, 2000);
          }
        }

        // Check if this message is a reply to one of our sent emails
        const matchedLog = sentLogs.find(l =>
          l.messageId && (inReplyTo.includes(l.messageId) || references.includes(l.messageId))
        );
        if (!matchedLog) continue;

        const ok = await processReply(
          { id: matchedLog.id, leadId: matchedLog.leadId, threadId: matchedLog.threadId || msg.id || null },
          account,
          replySubject,
          replyBody,
        );
        if (ok) replied++;
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`IMAP reply check failed for ${account.email}:`, err);
  } finally {
    try { await client.logout(); } catch {}
  }

  return replied;
}
