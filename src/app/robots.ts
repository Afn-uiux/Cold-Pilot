import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "https://usecoldpilot.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /dashboard, /admin, /auth, and /waitlist are intentionally NOT
      // disallowed here even though they're private/noindex — each of
      // those route groups sets its own `robots: { index: false }` meta
      // tag, which only works if crawlers are actually allowed to fetch
      // the page and read it. Disallowing a URL in robots.txt prevents
      // crawling entirely, which means a crawler can never see a noindex
      // tag on it — and a URL discovered via any external link can still
      // appear in search results as a bare link with no snippet. noindex
      // is the reliable way to keep a page out of search; robots.txt
      // Disallow is for saving crawl budget, not for de-indexing, and
      // combining both on the same path undermines the noindex.
      // /api has no HTML/meta tags at all, so disallowing it here is safe
      // and just saves crawl budget.
      disallow: ["/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}