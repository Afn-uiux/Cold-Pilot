import { prisma } from "@/lib/prisma";
import { sendSlackNotification } from "./slack";
import { hubspotLogActivity } from "./hubspot";
import { containsCalendlyLink } from "./calendly";

export async function dispatchIntegrationEvent(userId: string, event: string, data: Record<string, any>) {
  const integrations = await prisma.integration.findMany({ where: { userId, active: true } });

  let calendlyConfig: { link?: string } | null = null;

  for (const integration of integrations) {
    let config: any;
    try { config = JSON.parse(integration.config); } catch { continue; }

    try {
      switch (integration.provider) {
        case "slack":
          if (event === "reply") {
            await sendSlackNotification(config.webhookUrl, `*New Reply* from ${data.email}: ${data.message || ""}`);
          }
          break;
        case "hubspot":
          if (event === "reply") {
            await hubspotLogActivity(config.apiKey, data.email, "Replied to cold email");
          }
          break;
        case "calendly":
          calendlyConfig = config;
          break;
      }
    } catch (err) {
      console.error(`Integration ${integration.provider} failed:`, err);
    }
  }

  // Calendly: on reply, check if the sent email contained the Calendly link
  if (event === "reply" && calendlyConfig?.link && data.leadId) {
    try {
      const lastLog = await prisma.emailLog.findFirst({
        where: { leadId: data.leadId, type: "outgoing" },
        orderBy: { sentAt: "desc" },
        select: { bodyHtml: true },
      });
      if (lastLog?.bodyHtml && containsCalendlyLink(lastLog.bodyHtml, calendlyConfig.link)) {
        await prisma.lead.update({
          where: { id: data.leadId },
          data: { status: "replied" },
        });
      }
    } catch (err) {
      console.error("Calendly integration error:", err);
    }
  }
}
