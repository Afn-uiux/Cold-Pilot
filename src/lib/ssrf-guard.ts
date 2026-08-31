import dns from "dns/promises";
import net from "net";
import { isPrivateAddress } from "./ssrf";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);

/**
 * Validates a user-supplied URL before the server fetches it on their behalf.
 * Requires https, rejects internal-looking hostnames, and — for ordinary
 * domains — resolves DNS and rejects any address in a private/loopback/
 * link-local range (including IPv4-mapped and NAT64 IPv6 forms, via the shared
 * classifier in ./ssrf). This closes the DNS-rebinding gap a hostname-string
 * check alone misses (a public-looking domain that resolves to 127.0.0.1 or
 * the cloud metadata address).
 *
 * Note: resolution is checked here, not at the moment of the actual fetch, so a
 * narrow TOCTOU window remains against an attacker who can flip DNS between the
 * two. Callers that follow redirects MUST re-run this on every hop (see the
 * lead-import fetch), and should cap redirects + response size.
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
  if (
    hostname === "localhost" ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("URL host is not allowed");
  }

  // IP literal: validate directly (covers v4, v6, IPv4-mapped, NAT64).
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("URL host is not allowed");
    return parsed;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve URL host");
  }
  if (addresses.length === 0) {
    throw new Error("Could not resolve URL host");
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new Error("URL host is not allowed");
  }

  return parsed;
}

// Read a response body as text, aborting if it exceeds maxBytes (memory-DoS
// guard for user-supplied import URLs). Streams so an oversized body is never
// fully buffered.
export async function readResponseTextCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error("File is too large");
    return buf.toString("utf8");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new Error("File is too large");
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

const IMPORT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Fetch text from a user-supplied URL with SSRF-safe redirect handling:
 * validates the initial URL AND re-validates every redirect Location against
 * the private-address guard (redirect: "manual"), caps redirects and body
 * size, and never surfaces upstream response content in thrown errors. Use
 * this for any server-side fetch of an attacker-influenced URL.
 */
export async function fetchPublicText(
  urlString: string,
  opts?: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number }
): Promise<string> {
  const maxBytes = opts?.maxBytes ?? 10 * 1024 * 1024; // 10 MB
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const maxRedirects = opts?.maxRedirects ?? 3;

  let current = await assertPublicHttpsUrl(urlString);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": IMPORT_UA, Accept: "text/csv, text/plain, */*" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirected without a location");
      const next = new URL(loc, current);
      current = await assertPublicHttpsUrl(next.toString()); // re-validate EACH hop
      continue;
    }

    if (!res.ok) throw new Error(`Server returned ${res.status}. Make sure the link is a public CSV file.`);
    return readResponseTextCapped(res, maxBytes);
  }

  throw new Error("Too many redirects");
}
