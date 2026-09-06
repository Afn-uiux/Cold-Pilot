import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "https://usecoldpilot.com";

const staticRoutes: Array<{ path: string; freq: "daily" | "weekly" | "monthly" | "yearly" }> = [
  { path: "", freq: "daily" },
  { path: "/pricing", freq: "weekly" },
  { path: "/use-cases", freq: "weekly" },
  { path: "/use-cases/agencies", freq: "monthly" },
  { path: "/use-cases/founders", freq: "monthly" },
  { path: "/use-cases/fundraising", freq: "monthly" },
  { path: "/use-cases/recruiters", freq: "monthly" },
  { path: "/use-cases/sales", freq: "monthly" },
  { path: "/blog", freq: "weekly" },
  { path: "/docs", freq: "weekly" },
  { path: "/warmup", freq: "monthly" },
  { path: "/deliverability", freq: "monthly" },
  { path: "/analytics", freq: "monthly" },
  { path: "/personalization", freq: "monthly" },
  { path: "/rotation", freq: "monthly" },
  { path: "/reply-detection", freq: "monthly" },
  { path: "/about", freq: "monthly" },
  { path: "/contact", freq: "monthly" },
  { path: "/legal/privacy", freq: "yearly" },
  { path: "/legal/terms", freq: "yearly" },
  { path: "/legal/acceptable-use", freq: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map(({ path, freq }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: freq,
    priority: path === "" ? 1 : path.startsWith("/use-cases") ? 0.7 : 0.6,
  }));
}