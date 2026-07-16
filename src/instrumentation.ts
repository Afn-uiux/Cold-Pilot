export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { executeCampaign, checkForReplies } = await import("@/engine/campaign");

  async function tick() {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { status: "active", deletedAt: null },
        select: { id: true, userId: true },
        take: 10,
      });

      if (campaigns.length === 0) return;

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

      const userIds = [...new Set(campaigns.map((c: { id: string; userId: string }) => c.userId))];
      for (const uid of userIds as string[]) {
        try {
          const result = await checkForReplies(uid);
          if (result && result.replied > 0) {
            console.log(`[scheduler] replies ${uid}: ${result.replied} new`);
          }
        } catch (e) {
          console.error(`[scheduler] replies ${uid}:`, e);
        }
      }
    } catch (e) {
      console.error("[scheduler] tick error:", e);
    }
  }

  setInterval(tick, 120_000);
  tick();
}
