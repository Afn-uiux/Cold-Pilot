import { prisma } from "./prisma";
import crypto from "crypto";

interface WebhookEvent {
  event: string;
  userId: string;
  data: Record<string, any>;
}

export async function dispatchWebhookEvent(event: WebhookEvent) {
  const webhooks = await prisma.webhook.findMany({
    where: { userId: event.userId, active: true },
  });

  for (const wh of webhooks) {
    let events: string[];
    try { events = JSON.parse(wh.events); } catch { events = ["open", "click", "reply", "bounce"]; }

    if (!events.includes(event.event)) continue;

    const payload = JSON.stringify({ event: event.event, data: event.data, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac("sha256", wh.secret || "").update(payload).digest("hex");

    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature, "User-Agent": "Coldpilot-Webhook/1.0" },
        body: payload,
      });
      await prisma.webhook.update({ where: { id: wh.id }, data: { lastStatus: res.status } }).catch(() => {});
    } catch {
      await prisma.webhook.update({ where: { id: wh.id }, data: { lastStatus: 0 } }).catch(() => {});
    }
  }
}
