// Node.js-only scheduler bootstrap. Imported ONLY from instrumentation.ts
// inside `if (process.env.NEXT_RUNTIME === "nodejs")`, so Turbopack never
// traces these Node-dependent modules (prisma, campaign engine, warmup
// IMAP/email code) into the Edge instrumentation bundle.

export {};

const { assertSecureEnv } = await import("@/lib/env-guard");
assertSecureEnv();

const { prisma } = await import("@/lib/prisma");
const { executeCampaign, checkForReplies, sendDailySummaries } = await import("@/engine/campaign");
const { reconcileWarmupSchedules, processDueWarmupSends, processSeedInboxes, processSeedInboxEngagement, processSeedSends, saveHealthLog } = await import("@/engine/warmup");
const { acquireLock, newLeaderToken } = await import("@/lib/leader-lock");
const { sweepPlanExpiries } = await import("@/lib/plan-expiry");

const leaderToken = newLeaderToken();
let lastSummaryDate = "";
let lastHealthCheckHour = -1;
// Re-entrancy guard: setInterval fires every 2 minutes regardless of whether
// the previous async tick has finished. A tick that runs long (IMAP scans,
// seed sends with randomized bleed times, campaign sends) must never overlap
// the next one — overlapping ticks race the min-wait / daily-count checks and
// duplicate sends. When a tick is still in flight, skip the new one entirely.
let tickInFlight = false;

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

    const campaigns = await prisma.campaign.findMany({
      where: { status: "active", deletedAt: null },
      select: { id: true, userId: true },
      take: 10,
    });

    if (campaigns.length > 0) {
      console.log(`[scheduler] tick: ${campaigns.length} active campaign(s)`);

      await Promise.allSettled(campaigns.map(async (c: { id: string; userId: string }) => {
        try {
          const result = await executeCampaign(c.id);
          if (result && (result.sent > 0 || result.errors > 0)) {
            console.log(`[scheduler] campaign ${c.id}: sent=${result.sent} errors=${result.errors} skipped=${result.skipped}`);
          }
        } catch (e) {
          console.error(`[scheduler] campaign ${c.id}:`, e);
        }
      }));
    }

    // Reply detection runs regardless of campaign status — leads can
    // reply after their campaign has finished.
    const accounts = await prisma.emailAccount.findMany({
      where: { status: "active", deletedAt: null },
      select: { userId: true },
      distinct: ["userId"],
    });
    for (const { userId } of accounts) {
      try {
        const result = await checkForReplies(userId);
        if (result && result.replied > 0) {
          console.log(`[scheduler] replies ${userId}: ${result.replied} new`);
        }
      } catch (e) {
        console.error(`[scheduler] replies ${userId}:`, e);
      }
    }

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

    // Health check — once per hour
    if (!lastHealthCheckHour || lastHealthCheckHour !== new Date().getHours()) {
      lastHealthCheckHour = new Date().getHours();
      try {
        const accounts = await prisma.emailAccount.findMany({
          where: { warmupEnabled: true, status: "active", deletedAt: null, user: { plan: { not: "free" } } },
          select: { id: true },
        });
        for (const a of accounts) {
          await saveHealthLog(a.id);
        }
        console.log(`[scheduler] health check: ${accounts.length} accounts`);
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