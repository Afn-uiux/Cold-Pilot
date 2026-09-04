import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  title: "Coldpilot — Cold email that lands in the inbox",
  description: "Send campaigns that land in inboxes, not spam folders. Warm-up, rotation, reply detection — all in one place.",
  openGraph: {
    title: "Coldpilot — Cold email that lands in the inbox",
    description: "Send campaigns that land in inboxes, not spam folders.",
    url: "https://usecoldpilot.com",
    siteName: "Coldpilot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coldpilot — Cold email that lands in the inbox",
    description: "Send campaigns that land in inboxes, not spam folders.",
  },
  metadataBase: new URL("https://usecoldpilot.com"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full">
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
