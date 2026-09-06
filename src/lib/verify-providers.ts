export const PROBE_UNRELIABLE_PROVIDERS: ReadonlySet<string> = new Set([
  "Google",
  "Microsoft",
  "Yahoo",
  "AOL",
]);

// These consumer giants return a synthetic "550 mailbox not found" to raw
// port-25 probes for BOTH existing and dead addresses (anti-harvesting), so a
// probe 550 from one of them proves nothing. Only evidence collected offline
// (format, MX, global intel) can mark such an address "invalid"; a probe
// rejection must degrade to "unknown" and let the bounce net catch genuinely
// dead mailboxes instead.
export function isProbeUnreliableProvider(provider: string): boolean {
  return PROBE_UNRELIABLE_PROVIDERS.has(provider);
}

// Raw port-25 "mailbox not found" verdict: on probe-unreliable providers it
// proves nothing (unknown); everywhere else it is a definitive hard invalid.
export function probe550Verdict(provider: string): "invalid" | "unknown" {
  return isProbeUnreliableProvider(provider) ? "unknown" : "invalid";
}