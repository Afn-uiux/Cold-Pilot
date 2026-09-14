// Node.js-only scheduler bootstrap. Imported ONLY from instrumentation.ts
// inside `if (process.env.NEXT_RUNTIME === "nodejs")`, so Turbopack never
// traces these Node-dependent modules (prisma, campaign engine, warmup
// IMAP/email code) into the Edge instrumentation bundle.

export {};

const { assertSecureEnv } = await import("@/lib/env-guard");
assertSecureEnv();

const { prisma } = await import("@/lib/prisma");
const { executeCampaign, checkForReplies, sendDailySummaries } = await import("@/engine/campaign");
const { reconcileWarmupSchedules, processDueWarmupSends, processSeedInboxes, processSeedInboxEngagement, processSeedSends, saveHealthLog, saveSeedHealthLog } = await import("@/engine/warmup");
const { acquireLock, newLeaderToken } = await import("@/lib/leader-lock");
const { runConcurrent } = await import("@/lib/concurrency");
const { sweepPlanExpiries } = await import("@/lib/plan-expiry");
const { sweepBillingFollowUps } = await import("@/lib/billing-followup");
const { sweepFounderWelcome } = await import("@/lib/founder-welcome");
const { sweepTrialCheckups } = await import("@/lib/trial-followup");
const { sweepOnboardingNudges } = await import("@/lib/onboarding-nudges");

const leaderToken = newLeaderToken();
let lastSummaryDate = "";
let lastHealthCheckHour = -1;
// Re-entrancy guard: setInterval fires every 2 minutes regardless of whether
// the previous async tick has finished. A tick that runs long (IMAP scans,
// seed sends with randomized bleed times, campaign sends) must never overlap
// the next one — overlapping ticks race the min-wait / daily-count checks and
// duplicate sends. When a tick is still in flight, skip the new one entirely.
let tickInFlight = false;

// How many campaigns' pacing checks run concurrently per tick. This is
// checks, not sends — real sends stay separately rate-limited per account
// regardless of this number. Tune up if the DB/host has headroom, down if
// you see connection-pool pressure in logs.
const CAMPAIGN_TICK_CONCURRENCY = 50;

async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await tickInner();
  } finally {
    tickInFlight = false;
  }
}

async function tickInner() {
  try {
    // Leader election: only the instance holding the live lease may run
    // background work. Without this, every deployed instance would execute
    // the same campaign sends / reply checks on its own 2-minute timer and
    // duplicate emails. The lease is renewed each tick; if this instance
    // loses the lease (another instance won the race), skip this round.
    const isLeader = await acquireLock("scheduler", leaderToken);
    if (!isLeader) return;

    // Previously: take:10 with no ordering — SQLite's stable default row
    // order meant the SAME first 10 active campaigns got processed every
    // tick, forever, once there were more than 10 active at once. Campaign
    // #11 onward never sent anything, silently, with no error anywhere.
    //
    // Fix: order by lastCheckedAt (oldest/never-checked first) so every
    // active campaign gets a turn on a fair rotation, and raise the batch
    // size well above any realistic per-tick load. Most calls to
    // executeCampaign() are cheap no-ops (pacing gates decide nothing is
    // due yet) — the expensive part is real sends, which are already
    // separately rate-limited per account — so a large batch size does NOT
    // mean 1,000 concurrent SMTP connections, just 1,000 lightweight
    // "is anything due" checks, run with bounded concurrency below.
    const campaigns = await prisma.campaign.findMany({
      where: { status: "active", deletedAt: null },
      select: { id: true, userId: true },
      orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      take: 1000,
    });

    if (campaigns.length > 0) {
      console.log(`[scheduler] tick: ${campaigns.length} active campaign(s)`);

      // Bounded concurrency instead of unbounded Promise.allSettled — with
      // hundreds/thousands of active campaigns, firing all of them at once
      // would spike DB connection usage and, on any tick where many
      // campaigns genuinely have a send due, open far too many simultaneous
      // SMTP/IMAP connections at once. A cap keeps throughput high without
      // that spike; raise CAMPAIGN_TICK_CONCURRENCY if the DB/host can take
      // more, lower it if you see connection-pool pressure.
      await runConcurrent(campaigns, async (c: { id: string; userId: string }) => {
        try {
          const result = await executeCampaign(c.id);
          if (result && (result.sent > 0 || result.errors > 0)) {
            console.log(`[scheduler] campaign ${c.id}: sent=${result.sent} errors=${result.errors} skipped=${result.skipped}`);
          }
        } catch (e) {
          console.error(`[scheduler] campaign ${c.id}:`, e);
        } finally {
          try {
            await prisma.campaign.update({ where: { id: c.id }, data: { lastCheckedAt: new Date() } });
          } catch {
            // Non-fatal — worst case this campaign is checked again sooner
            // than strictly necessary on the next tick's rotation.
          }
        }
      }, CAMPAIGN_TICK_CONCURRENCY);
    }

    // Reply detection runs regardless of campaign status — leads can
    // reply after their campaign has finished. Users share no mailboxes, so
    // their scans are independent: run them concurrently (capped) instead of
    // one-at-a-time. Each IMAP/Gmail round-trip blocks this tick for ~1s, and
    // with hundreds of users the serial version alone would exceed the
    // 2-minute tick budget and skip rounds.
    const accounts = await prisma.emailAccount.findMany({
      where: { status: "active", deletedAt: null },
      select: { userId: true },
      distinct: ["userId"],
    });
    const userIds = accounts.map(a => a.userId);
    await runConcurrent(userIds, async (userId) => {
      try {
        const result = await checkForReplies(userId);
        if (result && result.replied > 0) {
          console.log(`[scheduler] replies ${userId}: ${result.replied} new`);
        }
      } catch (e) {
        console.error(`[scheduler] replies ${userId}:`, e);
      }
    });

    // Daily summary — once per day
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastSummaryDate) {
      lastSummaryDate = today;
      try {
        await sendDailySummaries();
        console.log("[scheduler] daily summaries sent");
      } catch (e) {
        console.error("[scheduler] daily summary error:", e);
      }
    }

    // One-time plan expiry — downgrade expired plans, fire pre-expiry
    // reminder emails (bitmask-gated, so each sends exactly once).
    try {
      const sweep = await sweepPlanExpiries();
      if (sweep.downgraded > 0 || sweep.reminded3d > 0 || sweep.reminded1d > 0) {
        console.log("[scheduler] plan-expiry sweep:", JSON.stringify(sweep));
      }
    } catch (e) {
      console.error("[scheduler] plan-expiry error:", e);
    }

    // Founder welcome — fires a few minutes after verification, once the auth
    // welcome has had a beat to land. founderWelcomeSentAt makes it once-per-user.
    try {
      const founderWelcome = await sweepFounderWelcome();
      if (founderWelcome.sent > 0) {
        console.log("[scheduler] founder welcome:", JSON.stringify(founderWelcome));
      }
    } catch (e) {
      console.error("[scheduler] founder welcome error:", e);
    }

    // Founder trial check-ins — "wrapping up" in the last 3 days of the trial,
    // "don't stop now" right after it ends. Each fires once per user.
    try {
      const trialCheckups = await sweepTrialCheckups();
      if (trialCheckups.expiring > 0 || trialCheckups.expired > 0) {
        console.log("[scheduler] trial checkups:", JSON.stringify(trialCheckups));
      }
    } catch (e) {
      console.error("[scheduler] trial checkups error:", e);
    }

    // Billing-exploration follow-up — free users who opened the Billing tab
    // and never subscribed get one founder email. Gated on BILLING_ENABLED, so
    // it stays dormant with the rest of billing.
    try {
      const billingSweep = await sweepBillingFollowUps();
      if (billingSweep.sent > 0) {
        console.log("[scheduler] billing follow-up:", JSON.stringify(billingSweep));
      }
    } catch (e) {
      console.error("[scheduler] billing follow-up error:", e);
    }

    // Onboarding nudges — one email per stuck step, sent while the user is
    // still in the setup window (never after they've done the step). Each
    // bit is stamped on the user so every nudge fires at most once.
    try {
      const nudgeSweep = await sweepOnboardingNudges();
      if (nudgeSweep.connect > 0 || nudgeSweep.campaign > 0 || nudgeSweep.leads > 0) {
        console.log("[scheduler] onboarding nudges:", JSON.stringify(nudgeSweep));
      }
    } catch (e) {
      console.error("[scheduler] onboarding nudges error:", e);
    }

    // Warmup engine — reconcile schedules, send due emails, process seed inboxes
    try {
      const reconciled = await reconcileWarmupSchedules();
      if (reconciled > 0) {
        console.log(`[scheduler] warmup reconciled: ${reconciled} scheduled`);
      }
    } catch (e) {
      console.error("[scheduler] warmup reconcile error:", e);
    }

    try {
      const { sent, failed } = await processDueWarmupSends();
      if (sent > 0 || failed > 0) {
        console.log(`[scheduler] warmup sends: ${sent} sent, ${failed} failed`);
      }
    } catch (e) {
      console.error("[scheduler] warmup sends error:", e);
    }

    try {
      const imap = await processSeedInboxes();
      if (imap && (imap.rescued > 0 || imap.received > 0 || imap.replied > 0)) {
        console.log("[scheduler] warmup imap:", JSON.stringify(imap));
      }
    } catch (e) {
      console.error("[scheduler] warmup imap error:", e);
    }

    // Seed engagement — seeds behave like live inboxes: receive, reply,
    // mark important, and rescue from spam (bidirectional participation).
    try {
      const seedEng = await processSeedInboxEngagement();
      if (seedEng && (seedEng.received > 0 || seedEng.replied > 0 || seedEng.rescued > 0)) {
        console.log("[scheduler] seed engagement:", JSON.stringify(seedEng));
      }
    } catch (e) {
      console.error("[scheduler] seed engagement error:", e);
    }

    // Seed sends — seeds warm each other (and eligible customer mailboxes) so
    // the network self-sustains even while idle.
    try {
      const seedSends = await processSeedSends();
      if (seedSends && (seedSends.sent > 0 || seedSends.failed > 0)) {
        console.log("[scheduler] seed sends:", JSON.stringify(seedSends));
      }
    } catch (e) {
      console.error("[scheduler] seed sends error:", e);
    }

    // Health check — once per hour. Runs for ALL warmup-enabled accounts,
    // including free/trial users (trials warm up too and their score must stay
    // honest), then every active seed. The first tick of a fresh boot runs this
    // immediately, so a new build corrects stored scores right away instead of
    // waiting up to an hour.
    if (!lastHealthCheckHour || lastHealthCheckHour !== new Date().getHours()) {
      lastHealthCheckHour = new Date().getHours();
      try {
        const accounts = await prisma.emailAccount.findMany({
          where: { warmupEnabled: true, status: "active", deletedAt: null, user: { deletedAt: null } },
          select: { id: true },
        });
        for (const a of accounts) {
          await saveHealthLog(a.id);
        }
        const seeds = await prisma.seedInbox.findMany({
          where: { status: "active" },
          select: { id: true },
        });
        for (const s of seeds) {
          await saveSeedHealthLog(s.id);
        }
        console.log(`[scheduler] health check: ${accounts.length} accounts, ${seeds.length} seeds`);
      } catch (e) {
        console.error("[scheduler] health check error:", e);
      }
    }

    // Weekly digest — every Monday. Opt-in gate: DIGESTS_ENABLED=1 in the
    // environment AND the address must be verified (emailVerified set),
    // so we never blast unverified/nonexistent addresses.
    if (process.env.DIGESTS_ENABLED === "1" && new Date().getDay() === 1) {
      try {
        const { sendWeeklyDigests } = await import("@/engine/digest");
        const n = await sendWeeklyDigests();
        if (n > 0) console.log(`[scheduler] weekly digests sent to ${n} user(s)`);
      } catch (e) {
        console.error("[scheduler] weekly digest error:", e);
      }
    }

    // Monthly summary — 1st of each month. Same DIGESTS_ENABLED + verified gate.
    if (process.env.DIGESTS_ENABLED === "1" && new Date().getDate() === 1) {
      try {
        const { sendMonthlySummaries } = await import("@/engine/digest");
        const n = await sendMonthlySummaries();
        if (n > 0) console.log(`[scheduler] monthly summaries sent to ${n} user(s)`);
      } catch (e) {
        console.error("[scheduler] monthly summary error:", e);
      }
    }

    // Re-engagement — users inactive for 14 days
    // DISABLED: same rationale — "we-miss-you" mail to unverified/dead
    // addresses only harms sender reputation. Gate behind DIGESTS_ENABLED
    // semantics (or a proper opt-in) if this product decision changes.
  } catch (e) {
    console.error("[scheduler] tick error:", e);
  }
}

setInterval(tick, 120_000);
tick();