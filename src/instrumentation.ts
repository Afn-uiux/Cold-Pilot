export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { executeCampaign, checkForReplies, sendDailySummaries } = await import("@/engine/campaign");
  const { reconcileWarmupSchedules, processDueWarmupSends, processSeedInboxes, saveHealthLog } = await import("@/engine/warmup");

  let lastSummaryDate = "";
  let lastHealthCheckHour = -1;

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
    } catch (e) {
      console.error("[scheduler] tick error:", e);
    }
  }

  setInterval(tick, 120_000);
  tick();
}
