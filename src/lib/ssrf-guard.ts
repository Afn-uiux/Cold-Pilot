import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT (RFC6598)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped address — check the embedded IPv4.
    const v4 = lower.split(":").pop() || "";
    if (v4.includes(".")) return isPrivateIPv4(v4);
  }
  return false;
}

/**
 * Validates a user-supplied URL before the server fetches it on their
 * behalf. Requires https, rejects obviously-internal hostnames, and — for
 * ordinary domains — resolves DNS and rejects any address that lands in a
 * private/loopback/link-local range. This closes the DNS-rebinding gap that
 * a hostname-string check alone misses (a public-looking domain that
 * resolves to 127.0.0.1 or the cloud metadata address).
 *
 * Note: this checks resolution at validation time, not at the moment of the
 * actual fetch, so a narrow TOCTOU window remains against an attacker who
 * can flip DNS between the two. For this app's use case (one-off CSV import
 * fetch immediately after validation) that risk is low; pin the connection
 * to the resolved IP if a stronger guarantee is ever needed.
 */
export async function assertPublicHttpsUrl(urlString: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("URL host is not allowed");
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion) {
    const blocked = ipVersion === 4 ? isPrivateIPv4(hostname) : isPrivateIPv6(hostname);
    if (blocked) throw new Error("URL host is not allowed");
    return parsed;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve URL host");
  }
  if (addresses.length === 0) {
    throw new Error("Could not resolve URL host");
  }
  for (const { address, family } of addresses) {
    const blocked = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (blocked) throw new Error("URL host is not allowed");
  }

  return parsed;
}
