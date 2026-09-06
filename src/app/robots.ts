import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "https://usecoldpilot.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/auth", "/waitlist", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}