import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import JsonLd from "@/components/seo-jsonld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "https://usecoldpilot.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Nonce-based CSP (set per-request in src/proxy.ts) requires every page to be
// dynamically rendered so Next.js can inject the per-request nonce into its
// framework/inline scripts. This disables static pre-rendering/ISR/CDN caching;
// it is required for a strict, nonce-based Content-Security-Policy.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Coldpilot — Cold email that lands in the inbox",
    template: "%s | Coldpilot",
  },
  description: "Send campaigns that land in inboxes, not spam folders. Warm-up, rotation, reply detection — all in one place.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Coldpilot — Cold email that lands in the inbox",
    description: "Send campaigns that land in inboxes, not spam folders.",
    url: siteUrl,
    siteName: "Coldpilot",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${siteUrl}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Coldpilot — cold email that lands in the inbox",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coldpilot — Cold email that lands in the inbox",
    description: "Send campaigns that land in inboxes, not spam folders.",
    images: [`${siteUrl}/opengraph-image.png`],
  },
  metadataBase: new URL(siteUrl),
  robots: {
    index: true,
    follow: true,
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Coldpilot",
      url: siteUrl,
      logo: `${siteUrl}/coldpilot-logo.png`,
      description:
        "Cold email that lands in the inbox. Warm-up, rotation, reply detection, verification and analytics in one place.",
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Coldpilot",
      inLanguage: "en",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full">
        {<JsonLd data={orgSchema} />}
        {<Providers>{children}</Providers>}
        {/* Cloudflare Web Analytics beacon (manual install; see .env.example). */}
        <script
          type="module"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "c81cc2e1e8a7411a97964b50c4d54d7e"}'
        />
      </body>
    </html>
  );
}
