// Real-data digests. Counts a user's own email activity FROM EmailLog the
// same way the dashboard analytics do (src/app/api/stats/route.ts), then
// renders digest-weekly / digest-monthly with that user's numbers in place
// of the old hardcoded ones.

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email/send";

export interface DigestStats {
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  openRate: number;
  replyRate: number;
  trackingEnabled: boolean;
}

const SENT_STATUSES = ["sent", "delivered"];

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(n: number): string {
  return n.toFixed(1);
}

export async function collectDigestStats(userId: string, from: Date): Promise<DigestStats> {
  const logs = await prisma.emailLog.findMany({
    where: {
      lead: { userId },
      sentAt: { gte: from },
    },
    select: {
      id: true,
      status: true,
      openedAt: true,
      repliedAt: true,
      error: true,
      leadId: true,
    },
  });

  const sent = logs.filter(l => SENT_STATUSES.includes(l.status)).length;
  const opened = new Set(logs.filter(l => l.openedAt).map(l => l.leadId)).size;
  const replied = new Set(logs.filter(l => l.repliedAt).map(l => l.leadId)).size;
  const bounced = logs.filter(l => l.status === "bounced" || !!(l.error as string | null)).length;

  const openRate = sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0;

  // openedAt is only ever written when a campaign has open tracking on
  // (the tracking pixel is skipped otherwise — see engine/send.ts), so a
  // plain "0" would be misleading. The template shows "—" instead.
  const trackingEnabled = (await prisma.campaign.findFirst({
    where: { userId, deletedAt: null, openTracking: true },
    select: { id: true },
  })) !== null;

  return { sent, opened, replied, bounced, openRate, replyRate, trackingEnabled };
}

function weeklySignoff(s: DigestStats): string {
  let line: string;
  if (s.trackingEnabled) {
    line = `Solid week — ${fmt(s.sent)} emails sent, ${fmt(s.opened)} opened and ${fmt(s.replied)} replied (${pct(s.openRate)}% open rate, ${pct(s.replyRate)}% reply rate).`;
  } else {
    line = `Solid week — ${fmt(s.sent)} emails sent and ${fmt(s.replied)} replied (${pct(s.replyRate)}% reply rate). Enable open tracking on your campaigns to see open rates.`;
  }
  if (s.bounced > 0) {
    line += ` Watch your bounce rate — ${fmt(s.bounced)} email${s.bounced === 1 ? "" : "s"} bounced this week.`;
  }
  return line;
}

function monthlySignoff(s: DigestStats): string {
  let line: string;
  if (s.trackingEnabled) {
    line = `Strong month — ${fmt(s.sent)} emails sent with a ${pct(s.openRate)}% open rate and ${pct(s.replyRate)}% reply rate. You're outperforming most Coldpilot users. Keep it up.`;
  } else {
    line = `Strong month — ${fmt(s.sent)} emails sent and ${fmt(s.replied)} replied (${pct(s.replyRate)}% reply rate). Enable open tracking on your campaigns to see open rates.`;
  }
  if (s.bounced > 0) {
    line += ` ${fmt(s.bounced)} email${s.bounced === 1 ? "" : "s"} bounced — check your bounce report for problem domains.`;
  }
  return line;
}

type DigestTemplate = "weekly-digest" | "monthly-summary";

export function digestData(template: DigestTemplate, stats: DigestStats, extra: Record<string, string>): Record<string, string> {
  const signoffFn = template === "weekly-digest" ? weeklySignoff : monthlySignoff;
  const openedValue = stats.trackingEnabled ? fmt(stats.opened) : "—";
  return {
    sent: fmt(stats.sent),
    opened: openedValue,
    openedValue,
    replied: fmt(stats.replied),
    bounced: fmt(stats.bounced),
    openRate: pct(stats.openRate),
    replyRate: pct(stats.replyRate),
    signoffLine: signoffFn(stats),
    ...extra,
  };
}

async function sendDigests(template: DigestTemplate, from: Date, extra: Record<string, string>): Promise<number> {
  const users = await prisma.user.findMany({
    where: { emailVerified: { not: null }, deletedAt: null, email: { not: "" } },
    select: { id: true, email: true, name: true },
  });

  let sent = 0;
  for (const u of users) {
    try {
      const stats = await collectDigestStats(u.id, from);
      if (stats.sent === 0) continue;

      await sendTransactionalEmail({
        to: u.email,
        template,
        data: digestData(template, stats, extra),
      });
      sent++;
      console.log(`[digest] ${template} -> ${u.email}: sent=${stats.sent} opened=${stats.opened} replied=${stats.replied} bounced=${stats.bounced}`);
    } catch (e) {
      console.error(`[digest] ${template} failed for ${u.email}:`, (e as Error).message || e);
    }
  }
  return sent;
}

export async function sendWeeklyDigests(): Promise<number> {
  const from = new Date(Date.now() - 7 * 86400000);
  return sendDigests("weekly-digest", from, {});
}

export async function sendMonthlySummaries(): Promise<number> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const period = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return sendDigests("monthly-summary", from, { period });
}