import { prisma } from "@/lib/prisma";

export async function getCalendlyLink(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: "calendly" } },
  });
  if (!integration) return null;
  try {
    const config = JSON.parse(integration.config);
    return config.link || null;
  } catch {
    return null;
  }
}

export function containsCalendlyLink(html: string, link: string): boolean {
  if (!html || !link) return false;
  return html.includes(link) || html.toLowerCase().includes("calendly.com/");
}

export function getCalendlyLinkDisplay(link: string): string {
  try {
    const url = new URL(link);
    return url.host + url.pathname;
  } catch {
    return link;
  }
}
