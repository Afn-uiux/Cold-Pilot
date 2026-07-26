export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { executeCampaign, checkForReplies, sendDailySummaries } = await import("@/engine/campaign");
  const { reconcileWarmupSchedules, processDueWarmupSends, processSeedInboxes, saveHealthLog } = await import("@/engine/warmup");
  const { sendEmailSafe } = await import("@/lib/email/send");

  let lastSummaryDate = "";
  let lastHealthCheckHour = -1;
  let lastWeeklyDigestDate = "";
  let lastMonthlyDigestDate = "";
  let lastReengagementDate = "";

  async function tick() {
    try {
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
        where: { status: "active" },
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
        if (imap && ((imap as any).spamRescued > 0 || (imap as any).processed > 0)) {
          console.log("[scheduler] warmup imap:", JSON.stringify(imap));
        }
      } catch (e) {
        console.error("[scheduler] warmup imap error:", e);
      }

      // Health check — once per hour
      if (!lastHealthCheckHour || lastHealthCheckHour !== new Date().getHours()) {
        lastHealthCheckHour = new Date().getHours();
        try {
          const accounts = await prisma.emailAccount.findMany({
            where: { warmupEnabled: true, status: "active" },
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

      // Weekly digest — every Monday
      const todayDate = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 1 && todayDate !== lastWeeklyDigestDate) {
        lastWeeklyDigestDate = todayDate;
        try {
          const users = await prisma.user.findMany({
            select: { id: true, email: true },
          });
          for (const user of users) {
            if (user.email) sendEmailSafe(user.email, "weekly-digest");
          }
          console.log(`[scheduler] weekly digest sent to ${users.length} users`);
        } catch (e) {
          console.error("[scheduler] weekly digest error:", e);
        }
      }

      // Monthly summary — 1st of each month
      const dayOfMonth = new Date().getDate();
      if (dayOfMonth === 1 && todayDate !== lastMonthlyDigestDate) {
        lastMonthlyDigestDate = todayDate;
        try {
          const users = await prisma.user.findMany({
            select: { id: true, email: true },
          });
          for (const user of users) {
            if (user.email) sendEmailSafe(user.email, "monthly-summary");
          }
          console.log(`[scheduler] monthly summary sent to ${users.length} users`);
        } catch (e) {
          console.error("[scheduler] monthly summary error:", e);
        }
      }

      // Re-engagement — users inactive for 14 days
      if (todayDate !== lastReengagementDate) {
        lastReengagementDate = todayDate;
        try {
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          const inactiveUsers = await prisma.user.findMany({
            where: {
              updatedAt: { lt: fourteenDaysAgo },
              campaigns: { none: { status: "active", deletedAt: null } },
            },
            select: { id: true, email: true },
          });
          for (const user of inactiveUsers) {
            if (user.email) sendEmailSafe(user.email, "we-miss-you");
          }
          console.log(`[scheduler] re-engagement sent to ${inactiveUsers.length} users`);
        } catch (e) {
          console.error("[scheduler] re-engagement error:", e);
        }
      }
    } catch (e) {
      console.error("[scheduler] tick error:", e);
    }
  }

  setInterval(tick, 120_000);
  tick();
}
