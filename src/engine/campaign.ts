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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  // Per-email pacing: nextAllowed tracks the earliest time the NEXT send for
  // this campaign may go out, persisted in the database so it survives restarts.
  // Every additional due lead within the same tick actually waits out the
  // remaining gap via a real timer before sending.
  let nextAllowed = campaign.nextAllowedSendAt ? campaign.nextAllowedSendAt.getTime() : 0;

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
    // Hoisted so both Phase 1 (initial send) and Phase 2 (follow-ups) can use
    // it — it was previously declared only inside Phase 1's try block, so
    // every follow-up send threw "accountSignature is not defined" and was
    // silently swallowed by the catch block below as a failed/rolled-back send.
    const accountSignature = (account as any)?.signature || "";

    if (!step) {
      // All steps completed — mark lead as done
      if (lead.status === "sent") {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "completed" } });
      }
      continue;
    }

    // Refuse to send a genuinely blank email (no subject and no body)
    const stepHasContent = Boolean(step.subject?.trim()) || Boolean(step.bodyHtml?.trim());
    if (!stepHasContent) {
      console.error(`[campaign] step ${step.id} (order ${step.order}) has no subject or body — skipping send for lead ${lead.id}`);
      skipped++;
      continue;
    }

    // Daily cap check (includes emails sent in previous ticks today)
    if (todaySent + emailCount >= campaignCap) { skipped++; continue; }

    // Time gap pacing — actually wait out any remaining gap
    const waitMs = nextAllowed - Date.now();
    if (waitMs > 0) await sleep(waitMs);

    // Phase 1: Send initial email to pending leads
    if (lead.status === "pending" && currentStepIdx === 0) {
      // Atomically claim this lead — prevents duplicate sends from concurrent ticks
      const claimResult = await prisma.lead.updateMany({
        where: { id: lead.id, status: "pending", currentStep: 0 },
        data: { status: "sent", currentStep: 1, lastSentAt: new Date() },
      });
      if (claimResult.count === 0) { skipped++; continue; }

      try {
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
          fromName: account.displayName || undefined,
          emailAccountId: account.id,
          leadId: lead.id,
          campaignStepId: step.id,
          trackingId: lead.id,
          openTracking: campaign.openTracking,
          clickTracking: campaign.clickTracking,
        });

        sent++;
        emailCount++;
        nextAllowed = Date.now() + minGap + (maxExtra > 0 ? Math.random() * maxExtra : 0);
        await prisma.campaign.update({ where: { id: campaignId }, data: { nextAllowedSendAt: new Date(nextAllowed) } });
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
        // Send as reply to thread (for threading). We need the *entire* prior
        // chain for this lead to build a correct References header — using
        // only the immediately previous message (as before) is technically
        // incomplete per the email threading spec and some clients rely on
        // the full chain, not just the last hop, to group messages.
        const priorLogs = await prisma.emailLog.findMany({
          where: { leadId: lead.id, type: "outgoing", messageId: { not: null } },
          orderBy: { sentAt: "asc" },
          select: { messageId: true, threadId: true },
        });
        const lastLog = priorLogs[priorLogs.length - 1] || null;
        const referencesChain = priorLogs.map(l => l.messageId).filter(Boolean).join(" ") || null;

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
        // A follow-up that's threaded via headers but whose subject doesn't
        // carry "Re:" still shows up as a new conversation in some clients
        // (Yahoo included), which use subject as a secondary threading signal
        // alongside In-Reply-To/References. Always prefix it when replying.
        if (lastLog && !/^re:/i.test(fupSubject.trim())) {
          fupSubject = `Re: ${fupSubject}`;
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
        });

        sent++;
        emailCount++;
        nextAllowed = Date.now() + minGap + (maxExtra > 0 ? Math.random() * maxExtra : 0);
        await prisma.campaign.update({ where: { id: campaignId }, data: { nextAllowedSendAt: new Date(nextAllowed) } });
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
        // Roll back the optimistic claim so the lead can be retried. Note:
        // lastSentAt is deliberately left untouched here — a follow-up send
        // requires lastSentAt to be set at all (see the "Phase 2" condition
        // above), so nulling it on error would permanently stop this lead
        // from ever being retried instead of just delaying it.
        await prisma.lead.update({
          where: { id: lead.id },
          data: { currentStep: currentStepIdx, status: "sent" },
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
      await checkImapAccountBounces(account);
    } else {
      console.log(`[reply] Skipping ${account.email}: no gmailToken and no IMAP creds`);
    }
  }

  return { replied };
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
      const uids = allUids.slice(-300);

      const bounceSenderPattern = /mailer-daemon|postmaster|mail delivery subsystem|mail-delivery|no-?reply.*delivery|delivery.*status.*notification/i;
      let bounceCandidates = 0;

      for await (const msg of client.fetch(uids, { uid: true, source: true })) {
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

        if (bounce.suppress) {
          await prisma.suppression.upsert({
            where: { userId_email: { userId: account.userId, email: failedRecipient } },
            update: {},
            create: { userId: account.userId, email: failedRecipient, reason: bounce.type, type: "bounce" },
          });
        }
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
      threadId: { not: null },
    },
    select: { threadId: true, id: true, leadId: true },
    orderBy: { sentAt: "desc" },
    take: 300,
  });

  console.log(`[reply] Gmail check for ${account.email}: ${sentLogs.length} pending threads`);

  for (const log of sentLogs) {
    if (!log.threadId) continue;
    try {
      const threadResult = await checkGmailThread(account.gmailToken, log.threadId, account.email);
      if (threadResult) {
        const ok = await processReply(log, account, threadResult.subject, threadResult.body);
        if (ok) replied++;
      }
    } catch (err: any) {
      // An expired/revoked refresh token fails the same way for every thread
      // in this account and was previously only ever logged to the server
      // console, so the user had no way of knowing reply detection had
      // silently stopped working. Surface it on the account and stop
      // burning through the rest of this account's threads on the same
      // dead token.
      const authFailed = err?.code === 401 || err?.code === "EAUTH" ||
        (typeof err?.message === "string" && (err.message.includes("invalid_grant") || err.message.includes("invalid_token")));
      if (authFailed) {
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
        break;
      }
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
    select: { id: true, leadId: true, messageId: true, threadId: true, subject: true, lead: { select: { email: true } } },
    take: 300,
  });

  if (sentLogs.length === 0) return 0;

  // Maps a lead's email address -> leadId, used by the subject/sender
  // fallback matcher below for replies that don't carry In-Reply-To/References.
  const leadEmailById = new Map<string, string>();
  for (const l of sentLogs) {
    if (l.lead?.email) leadEmailById.set(l.lead.email.toLowerCase(), l.leadId);
  }

  console.log(`[reply] IMAP check for ${account.email}: ${sentLogs.length} pending logs`);

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
      const uids = allUids.slice(-300);
      console.log(`[reply] IMAP INBOX: ${uids.length} messages in last 7 days`);

      let checkedCount = 0;
      let matchAttempts = 0;

      // We only need the raw source to parse headers — msg.headers in ImapFlow
      // is a Buffer, not a Map, so we parse headers from msg.source instead.
      for await (const msg of client.fetch(uids, { uid: true, source: true })) {
        checkedCount++;
        const rawSource = msg.source?.toString() || "";
        if (!rawSource) continue;

        // Parse headers from raw source (everything before the first blank line)
        const headerEnd = rawSource.indexOf("\r\n\r\n");
        const headerBlock = headerEnd >= 0 ? rawSource.slice(0, headerEnd) : rawSource;
        const headerLines = headerBlock.split(/\r?\n/);

        // Fold headers: continuation lines (starting with whitespace) belong to the previous header
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
        if (from.toLowerCase().includes(account.email.toLowerCase())) continue;

        const inReplyTo = headers["in-reply-to"] || "";
        const references = headers["references"] || "";
        const replySubject = headers["subject"] || "";
        // Normalize angle brackets for matching
        const normId = (id: string) => id.replace(/[<>]/g, "").trim();
        const normSubject = (s: string) => s.replace(/^(re|fwd?|fw)\s*:\s*/i, "").trim().toLowerCase();

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
            const candidateLeadId = leadEmailById.get(fromEmail);
            if (candidateLeadId && normReplySubject) {
              matchedLog = sentLogs.find(l =>
                l.leadId === candidateLeadId &&
                l.subject && normSubject(l.subject) === normReplySubject
              );
              if (matchedLog) matchMethod = "subject+sender";
            }
          }
        }

        if (!matchedLog) {
          if (inReplyTo || references) {
            console.log(`[reply] IMAP no match for message from ${from} — In-Reply-To/References present but didn't match any of ${sentLogs.length} pending Message-IDs`);
          }
          continue;
        }

        // Extract body from raw source
        let replyBody = "";
        if (headerEnd >= 0) {
          const afterHeaders = rawSource.slice(headerEnd + 4);
          const textMatch = afterHeaders.match(/Content-Type:\s*text\/plain[^]*?\n\n([^]*?)(?:\n--|\n\.\n|$)/i);
          if (textMatch && textMatch[1]) {
            replyBody = textMatch[1].trim().slice(0, 2000);
          } else {
            replyBody = afterHeaders.replace(/<[^>]*>/g, "").trim().slice(0, 2000);
          }
        }

        console.log(`[reply] IMAP matched reply to log ${matchedLog.id} from ${from} (method: ${matchMethod})`);
        const ok = await processReply(
          { id: matchedLog.id, leadId: matchedLog.leadId, threadId: matchedLog.threadId || msg.uid?.toString() || null },
          account,
          replySubject,
          replyBody,
        );
        if (ok) replied++;
      }

      console.log(`[reply] IMAP done: checked=${checkedCount} withReplyHeaders=${matchAttempts} replied=${replied}`);
    } finally {
      lock.release();
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
    }
  } finally {
    try { await client.logout(); } catch {}
  }

  return replied;
}
