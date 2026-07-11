export async function sendSlackNotification(webhookUrl: string, message: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) throw new Error(`Slack returned ${res.status}`);
}
