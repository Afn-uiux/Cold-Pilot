import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
