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
          // CSP to contain any HTML injection. frame-ancestors => clickjacking.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; " +
              "font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; " +
              "child-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
