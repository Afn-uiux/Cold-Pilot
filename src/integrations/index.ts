import { prisma } from "@/lib/prisma";
import { sendSlackNotification } from "./slack";
import { hubspotLogActivity } from "./hubspot";

export async function dispatchIntegrationEvent(userId: string, event: string, data: Record<string, any>) {
  const integrations = await prisma.integration.findMany({ where: { userId, active: true } });

  for (const integration of integrations) {
    let config: any;
    try { config = JSON.parse(integration.config); } catch { continue; }

    try {
      switch (integration.provider) {
        case "slack":
          switch (event) {
            case "reply":
              await sendSlackNotification(config.webhookUrl, `:speech_balloon: *New Reply* from ${data.email}: ${data.message || ""}`);
              break;
            case "bounce":
              await sendSlackNotification(config.webhookUrl, `:no_entry: *Bounced* ${data.email} — ${data.reason || "unknown"}`);
              break;
            case "campaign_completed":
              await sendSlackNotification(config.webhookUrl, `:white_check_mark: Campaign *${data.name || "Untitled"}* completed — ${data.sent || 0} sent, ${data.replies || 0} replies`);
              break;
            case "daily_summary":
              await sendSlackNotification(config.webhookUrl, `:bar_chart: *Daily Summary*\n• Sent: ${data.sent || 0}\n• Replies: ${data.replies || 0}\n• Bounces: ${data.bounces || 0}`);
              break;
          }
          break;
        case "hubspot":
          if (event === "reply") {
            await hubspotLogActivity(config.apiKey, data.email, "Replied to cold email");
          }
          break;
      }
    } catch (err) {
      console.error(`Integration ${integration.provider} failed:`, err);
    }
  }
}
