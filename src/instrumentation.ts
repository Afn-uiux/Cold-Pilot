export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { executeCampaign, checkForReplies } = await import("@/engine/campaign");

  async function tick() {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { status: "active" },
        select: { id: true, userId: true },
        take: 10,
      });

      if (campaigns.length === 0) return;

      for (const c of campaigns) {
        try {
          await executeCampaign(c.id);
        } catch (e) {
          console.error(`[scheduler] campaign ${c.id}:`, e);
        }
      }

      const userIds = [...new Set(campaigns.map(c => c.userId))];
      for (const uid of userIds) {
        try {
          await checkForReplies(uid);
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
