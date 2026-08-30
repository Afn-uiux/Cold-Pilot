import { prisma } from "./prisma";
import crypto from "crypto";
import { assertSafeSocketTarget } from "./ssrf";

interface WebhookEvent {
  event: string;
  userId: string;
  data: Record<string, any>;
}

const OUTBOUND_ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

async function isSafeWebhookUrl(rawUrl: string): Promise<boolean> {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
    if (!OUTBOUND_ALLOWED_PORTS.has(port)) return false;
    const err = await assertSafeSocketTarget(u.hostname, port);
    return err === null;
  } catch {
    return false;
  }
}

export async function dispatchWebhookEvent(event: WebhookEvent) {
  const webhooks = await prisma.webhook.findMany({
    where: { userId: event.userId, active: true },
  });

  for (const wh of webhooks) {
    let events: string[];
    try { events = JSON.parse(wh.events); } catch { events = ["open", "click", "reply", "bounce", "unsubscribe"]; }

    if (!events.includes(event.event)) continue;

    if (!(await isSafeWebhookUrl(wh.url))) {
      await prisma.webhook.update({ where: { id: wh.id }, data: { lastStatus: 0 } }).catch(() => {});
      continue;
    }

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
