// Centralizes Host-header validation and canonical-origin resolution so every
// redirect / callback / OAuth base URL is built from a value the operator
// controls, never from an attacker-supplied Host header (host-header poisoning
// / open-redirect via the login redirect and auth flows).

export function normalizedHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

export function canonicalOrigin(): string {
  return (
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

// Explicitly allow-listed hosts (comma-separated, e.g.
// "usecoldpilot.com,www.usecoldpilot.com"). When set, this is enforced in
// BOTH dev and prod. When unset, production falls back to matching the
// canonical origin's host exactly.
function allowedHosts(): string[] {
  return (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, "").toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
}

// True when the request Host is acceptable:
//   1. ALLOWED_HOSTS set  -> only those hosts pass.
//   2. Production, unset  -> host must equal the canonical origin's host.
//   3. Development        -> anything passes (localhost + tunnels), so local
//                            flows and Cloudflare-tunnel testing keep working.
export function isAllowedHost(host: string | null | undefined): boolean {
  const h = normalizedHost(host);
  if (!h) return false;

  const list = allowedHosts();
  if (list.length > 0) return list.includes(h);

  if (process.env.NODE_ENV !== "production") return true;

  const canonical = normalizedHost(canonicalOrigin());
  return !!canonical && h === canonical;
}

// Base origin used for redirect responses (login success, sign-out, etc.).
// Plain (non-proxied) development setups keep using the request host so the
// Cloudflare-tunnel / LAN-dev flows do not bounce to a dead canonical URL.
export function redirectBaseUrl(requestHost: string | null | undefined): string {
  if (process.env.NODE_ENV !== "production" && isAllowedHost(requestHost)) {
    const proto = process.env.NEXT_PUBLIC_URL?.startsWith("https://")
      ? "https"
      : process.env.TRUST_PROXY === "true"
        ? "https" // behind the tunnel/Cloudflare, forwarding is https
        : "http";
    return `${proto}://${requestHost}`;
  }
  return canonicalOrigin();
}