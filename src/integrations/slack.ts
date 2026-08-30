import { assertSafeSocketTarget } from "@/lib/ssrf";

export async function sendSlackNotification(webhookUrl: string, message: string) {
  try {
    const u = new URL(webhookUrl);
    if (u.protocol !== "https:") throw new Error("Slack webhook must use https");
    const err = await assertSafeSocketTarget(u.hostname, u.port ? Number(u.port) : 443);
    if (err) throw new Error("Slack webhook target not allowed");
  } catch {
    throw new Error("Unsafe Slack webhook URL");
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) throw new Error(`Slack returned ${res.status}`);
}
