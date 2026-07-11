export async function hubspotLogActivity(apiKey: string, email: string, activity: string) {
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { email } }),
  });
  if (!res.ok) throw new Error(`HubSpot returned ${res.status}`);
}
