import dns from "dns/promises";

const PRIVATE_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpv6Private(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower.startsWith("::1") || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fe")) return true; // fec0/fe80-ish
  return false;
}

function isPrivateIp(ip: string): boolean {
  const withoutBrackets = ip.replace(/^\[|\]$/g, "");
  if (withoutBrackets.includes(":")) return isIpv6Private(withoutBrackets);
  const int = ipToInt(ip);
  if (int === null) return true; // treat unparseable as unsafe
  for (const [range, prefix] of PRIVATE_RANGES) {
    const base = ipToInt(range)!;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    if ((int & mask) === (base & mask)) return true;
  }
  return false;
}

/**
 * Reject hostnames/IPs that are clearly unsafe to connect to (local/private/reserved
 * ranges, link-local IPv6, metadata endpoints). Also rejects raw IPs to force DNS
 * so we re-resolve, but importantly blocks private IP literals outright.
 *
 * Returns an error message, or null if the host+port combination is acceptable.
 */
export async function assertSafeSocketTarget(host: string, port: number, extra?: { dnsResolve?: boolean }): Promise<string | null> {
  const h = (host || "").trim().toLowerCase();

  // Host must be non-empty.
  if (!h) return "Host is required";

  // Reject obviously internal hostnames / metadata endpoints.
  const hostname = h.replace(/^\[|\]$/g, "").replace(/^\d+\.\d+\.\d+\.\d+$/, "");
  const lowerHost = hostname.toLowerCase();
  const reservedNames = /(^|\.)(localhost|local|internal|intranet|metadata|docker\.internal|\.loc\.|\.localdomain|home\.arpa|\.cloud\.google\.internal|\.internal\.cloudera\.com)$/i;
  if (lowerHost === "localhost" || reservedNames.test(lowerHost)) return "Host not allowed";

  // If an IP literal is given, reject private ranges immediately.
  const isIpLiteral = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
  if (isIpLiteral && isPrivateIp(hostname)) return "Private/reserved IP not allowed";
  if (isIpLiteral) return "Raw IP not allowed — use a hostname";

  if (extra?.dnsResolve === false) return null;

  // Resolve and confirm no private address is behind the hostname (DNS rebinding defense-in-depth).
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    const bad = addresses.find((a) => isPrivateIp(a.address));
    if (bad) return `Host resolves to a private/reserved address (${bad.address})`;
  } catch {
    // If it does not resolve, the actual connect will fail anyway.
  }

  return null;
}

/**
 * Port allow-list for SMTP/IMAP server endpoints. Custom ports (e.g. 2525, 465)
 * are common and legitimate for cold-email providers, so we allow a curated set.
 */
export function isAllowedSocketPort(port: number): boolean {
  return [
    25, 465, 587, 2525, // SMTP / SMTPS / submission / common alt
    143, 993, // IMAP
  ].includes(port);
}
