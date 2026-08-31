import dns from "dns/promises";
import net from "net";

// IPv4 ranges that must never be reachable via a user-supplied target.
const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let int = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    int = ((int << 8) | n) >>> 0;
  }
  return int >>> 0;
}

function isPrivateV4(ip: string): boolean {
  const int = ipv4ToInt(ip);
  if (int === null) return true; // unparseable → treat as unsafe
  for (const [range, prefix] of PRIVATE_V4) {
    const base = ipv4ToInt(range)!;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    if ((int & mask) === (base & mask)) return true;
  }
  return false;
}

// Pull an embedded IPv4 out of IPv4-mapped/compat and NAT64 IPv6 forms so a
// literal like ::ffff:169.254.169.254, ::ffff:a9fe:a9fe or 64:ff9b::a9fe:a9fe
// can't smuggle a private address past the v6 checks.
function embeddedV4(lower: string): string | null {
  const dotted = lower.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  const mapped = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, ""); // strip zone id
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(lower)) return true; // unique-local fc00::/7
  const v4 = embeddedV4(lower);
  if (v4) return isPrivateV4(v4);
  return false;
}

/**
 * True if the given IP *literal* is in a private/reserved/loopback/link-local
 * range (v4, v6, IPv4-mapped v6, or NAT64). Non-literals return false — the
 * caller must resolve the hostname to addresses and check each one.
 */
export function isPrivateAddress(ipOrLiteral: string): boolean {
  const h = ipOrLiteral.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const v = net.isIP(h);
  if (v === 4) return isPrivateV4(h);
  if (v === 6) return isPrivateV6(h);
  return false;
}

const RESERVED_NAMES =
  /(^|\.)(localhost|local|internal|intranet|lan|corp|home|metadata|metadata\.google\.internal|docker\.internal|localdomain|home\.arpa)$/i;

/**
 * Reject hostnames/IPs that are unsafe to connect to (loopback/private/reserved
 * ranges, link-local IPv6, cloud metadata endpoints, internal-looking names).
 *
 * IP literals are validated directly (no DNS, no string mangling); a *public*
 * literal is accepted as-is (it cannot DNS-rebind). Hostnames are resolved and
 * rejected if ANY resolved address is private/reserved. Fails closed: an
 * unresolvable host is rejected rather than waved through.
 *
 * Returns an error string, or null if the host is acceptable.
 *
 * Residual TOCTOU: nodemailer/imapflow re-resolve at connect time, so a rebind
 * between this check and the connect is not fully closed for those callers.
 * The window is small (connect happens immediately after) and both v4/v6
 * private ranges are covered; pin to the resolved IP if a hard guarantee is
 * ever required.
 */
export async function assertSafeSocketTarget(
  host: string,
  port: number,
  extra?: { dnsResolve?: boolean }
): Promise<string | null> {
  const h = (host || "").trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "").toLowerCase();

  if (!h) return "Host is required";
  if (h === "localhost" || RESERVED_NAMES.test(h)) return "Host not allowed";

  // IP literal: validate the address itself — never blank it out.
  if (net.isIP(h)) {
    if (isPrivateAddress(h)) return "Private/reserved IP not allowed";
    return null; // public IP literal — safe, and immune to DNS rebinding
  }

  if (extra?.dnsResolve === false) return null;

  try {
    const addresses = await dns.lookup(h, { all: true, verbatim: true });
    if (addresses.length === 0) return "Host does not resolve";
    const bad = addresses.find((a) => isPrivateAddress(a.address));
    if (bad) return `Host resolves to a private/reserved address (${bad.address})`;
  } catch {
    return "Host does not resolve";
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

/**
 * One-call guard for SMTP/IMAP client connects. Throws if the port is not an
 * allowed mail port, or if the host is missing / resolves into a private,
 * reserved, loopback, or link-local range (cloud metadata included). Await this
 * immediately before constructing a nodemailer/imapflow client from
 * user-configured account settings. `label` only shapes the error message.
 *
 * Combines isAllowedSocketPort + assertSafeSocketTarget so the five-plus
 * mail-connect sites stay consistent instead of each re-implementing the pair.
 */
export async function assertSafeMailTarget(
  host: string,
  port: number,
  label = "Mail"
): Promise<void> {
  const p = Number(port);
  if (!isAllowedSocketPort(p)) {
    throw new Error(`${label} port ${port} is not allowed`);
  }
  const err = await assertSafeSocketTarget(host, p);
  if (err) {
    throw new Error(`${label} host not allowed: ${err}`);
  }
}
