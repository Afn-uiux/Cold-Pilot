// Onboarding nudge sweeps. Replace the old post-hoc onboarding emails (sent
// AFTER the user had already done the step, e.g. "Create your first campaign"
// landing in the inbox right after the campaign was created) with scheduled
// nudges fired while the user is still STUCK on a step:
//   - connect-account  -> verified signup w/ no connected mailbox
//   - create-campaign  -> has a connected mailbox but no campaign
//   - import-leads     -> has a campaign but no imported leads
// Each fires exactly once per user, gated by a bitmask on onboardingNudgesSent
// (bit0/bit1/bit2) so the 2-minute scheduler tick can't double-send. Only
// recently-active users are eligible, so a month-old dormant signup never
// suddenly gets nudged (same rationale as founder-welcome's windowing).

import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email/send";

const DAY_MS = 24 * 60 * 60 * 1000;

export const ONBOARDING_CONNECT_MIN_MS = 24 * 60 * 60 * 1000; // 1 day after verification
export const ONBOARDING_CONNECT_MAX_MS = 14 * DAY_MS; // up to 2 weeks
export const ONBOARDING_CAMPAIGN_MIN_MS = 48 * 60 * 60 * 1000; // 2 days after first account
export const ONBOARDING_CAMPAIGN_MAX_MS = 30 * DAY_MS; // up to a month
export const ONBOARDING_LEADS_MIN_MS = 24 * 60 * 60 * 1000; // 1 day after first campaign
export const ONBOARDING_LEADS_MAX_MS = 14 * DAY_MS; // up to 2 weeks

const BIT_CONNECT = 1 << 0;
const BIT_CAMPAIGN = 1 << 1;
const BIT_LEADS = 1 << 2;

async function firstNameOf(user: { name?: string | null; email?: string | null }): Promise<string> {
  const raw = user.name?.trim();
  if (raw) return raw.split(/\s+/)[0]!;
  return user.email?.split("@")[0] || "there";
}

export async function sweepOnboardingNudges(): Promise<{
  connect: number;
  campaign: number;
  leads: number;
}> {
  const now = Date.now();
  let connect = 0;
  let campaign = 0;
  let leads = 0;

  // --- Connect-account nudge -------------------------------------------
  // Verified on signup between 1 and 14 days ago, never connected a mailbox
  // (no rows with deletedAt null), and the nudge hasn't gone out yet.
  const connectUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      emailVerified: {
        gte: new Date(now - ONBOARDING_CONNECT_MAX_MS),
        lte: new Date(now - ONBOARDING_CONNECT_MIN_MS),
      },
      emailAccounts: { none: { deletedAt: null } },
      onboardingNudgesSent: { lt: 8 },
    },
    select: { id: true, name: true, email: true, onboardingNudgesSent: true },
  });

  for (const user of connectUsers) {
    if ((user.onboardingNudgesSent & BIT_CONNECT) !== 0) continue;
    if (!user.email) continue;
    try {
      await sendTransactionalEmail({
        to: user.email,
        template: "onboarding-connect-account",
        data: { name: await firstNameOf(user) },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingNudgesSent: user.onboardingNudgesSent | BIT_CONNECT },
      });
      connect += 1;
    } catch (err) {
      console.error("[onboarding-nudges] connect nudge error for user", user.id, err);
    }
  }

  // --- Create-campaign nudge -------------------------------------------
  // Has an active mailbox but no campaign; the FIRST mailbox was created
  // between 2 and 30 days ago (so this is a still-plugged-in early user).
  const campaignUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      emailVerified: { not: null },
      emailAccounts: { some: { deletedAt: null } },
      campaigns: { none: { deletedAt: null } },
      onboardingNudgesSent: { lt: 8 },
    },
    select: {
      id: true,
      name: true,
      email: true,
      onboardingNudgesSent: true,
      emailAccounts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  for (const user of campaignUsers) {
    if ((user.onboardingNudgesSent & BIT_CAMPAIGN) !== 0) continue;
    if (!user.email) continue;
    const firstAccount = user.emailAccounts[0];
    if (!firstAccount?.createdAt) continue;
    const firstAccountMs = firstAccount.createdAt.getTime();
    if (now - firstAccountMs < ONBOARDING_CAMPAIGN_MIN_MS) continue;
    if (now - firstAccountMs > ONBOARDING_CAMPAIGN_MAX_MS) continue;
    try {
      await sendTransactionalEmail({
        to: user.email,
        template: "onboarding-create-campaign",
        data: { name: await firstNameOf(user) },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingNudgesSent: user.onboardingNudgesSent | BIT_CAMPAIGN },
      });
      campaign += 1;
    } catch (err) {
      console.error("[onboarding-nudges] campaign nudge error for user", user.id, err);
    }
  }

  // --- Import-leads nudge ----------------------------------------------
  // Has an active campaign but zero leads; the FIRST campaign was created
  // between 1 and 14 days ago (a half-built setup, not an abandoned one).
  const leadsUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      emailVerified: { not: null },
      campaigns: { some: { deletedAt: null } },
      leads: { none: { deletedAt: null } },
      onboardingNudgesSent: { lt: 8 },
    },
    select: {
      id: true,
      name: true,
      email: true,
      onboardingNudgesSent: true,
      campaigns: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  for (const user of leadsUsers) {
    if ((user.onboardingNudgesSent & BIT_LEADS) !== 0) continue;
    if (!user.email) continue;
    const firstCampaign = user.campaigns[0];
    if (!firstCampaign?.createdAt) continue;
    const firstCampaignMs = firstCampaign.createdAt.getTime();
    if (now - firstCampaignMs < ONBOARDING_LEADS_MIN_MS) continue;
    if (now - firstCampaignMs > ONBOARDING_LEADS_MAX_MS) continue;
    try {
      await sendTransactionalEmail({
        to: user.email,
        template: "onboarding-import-leads",
        data: { name: await firstNameOf(user) },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingNudgesSent: user.onboardingNudgesSent | BIT_LEADS },
      });
      leads += 1;
    } catch (err) {
      console.error("[onboarding-nudges] leads nudge error for user", user.id, err);
    }
  }

  return { connect, campaign, leads };
}