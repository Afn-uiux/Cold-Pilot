import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Allow the app to be loaded over a Cloudflare quick-tunnel (used for local
  // testing of open/click link tracking) without the dev server blocking the
  // HMR websocket and other dev resources as cross-origin. Without this,
  // hydration silently fails through the tunnel and buttons/links go dead.
  // Same reason: testing from a phone on the same LAN via the machine's LAN IP.
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.1.111"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS — force HTTPS for a year (including subdomains).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Frame embedding protection.
          { key: "X-Frame-Options", value: "DENY" },
          // MIME sniffing protection.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Do not leak the URL (which may carry reset tokens) via Referer.
          { key: "Referrer-Policy", value: "no-referrer" },
          // NOTE: Content-Security-Policy is NOT set here. It is set per-request
          // with a nonce in src/proxy.ts (required so Next.js can apply the
          // per-request nonce to its scripts). A static CSP here would conflict
          // with / defeat the nonce-based policy.
        ],
      },
    ];
  },
};

export default nextConfig;
