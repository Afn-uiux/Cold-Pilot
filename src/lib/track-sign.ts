import { createHash, createHmac, timingSafeEqual } from "crypto";

// Derives a purpose-specific key from the app's auth secret via a
// domain-separated hash, rather than reusing the raw secret directly for a
// different purpose (link signing vs. session signing).
function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env variable is not set");
  return createHash("sha256").update(`${secret}:track-redirect`).digest();
}

function getUnsubscribeKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env variable is not set");
  return createHash("sha256").update(`${secret}:unsubscribe`).digest();
}

// Signed links carry an issue timestamp so they can age out instead of being
// permanently replayable (audit L-5): a leaked old unsubscribe link can no
// longer re-opt a lead out forever, and old click-tracking redirects expire.
export const TRACK_SIG_TTL_MS = 30 * 24 * 60 * 60 * 1000; // click redirects: 30 days
export const UNSUBSCRIBE_SIG_TTL_MS = 365 * 24 * 60 * 60 * 1000; // unsubscribe: 1 year

function payload(leadId: string, stepId: string | undefined, url: string, ts: number): string {
  return `${leadId}:${stepId || ""}:${url}:${ts}`;
}

function isFresh(ts: number, ttlMs: number, now: number): boolean {
  return Number.isFinite(ts) && ts > 0 && now >= ts && now - ts <= ttlMs;
}

// Signs the (leadId, stepId, destination url, issuedAt) tuple so /api/track
// can prove a click-tracking redirect target is the one this app actually
// generated, instead of blindly trusting whatever `redirect` shows up.
export function signRedirect(
  leadId: string,
  stepId: string | undefined,
  url: string,
  ts: number = Date.now()
): string {
  return createHmac("sha256", getKey()).update(payload(leadId, stepId, url, ts)).digest("hex");
}

export function verifyRedirect(
  leadId: string,
  stepId: string | undefined,
  url: string,
  signature: string | null | undefined,
  tsValue: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!signature) return false;
  const ts = Number(tsValue);
  if (!isFresh(ts, TRACK_SIG_TTL_MS, now)) return false; // missing / future-dated / expired
  const expected = signRedirect(leadId, stepId, url, ts);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Signs the (leadId, issuedAt) tuple for the unsubscribe link so a recipient
// can only unsubscribe a lead whose token they actually hold, one lead's
// token can't be replayed against another, and old links eventually lapse.
export function signUnsubscribe(leadId: string, ts: number = Date.now()): string {
  return createHmac("sha256", getUnsubscribeKey()).update(`${leadId}:${ts}`).digest("hex");
}

export function verifyUnsubscribe(
  leadId: string,
  signature: string | null | undefined,
  tsValue: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!signature) return false;
  const ts = Number(tsValue);
  if (!isFresh(ts, UNSUBSCRIBE_SIG_TTL_MS, now)) return false;
  const expected = signUnsubscribe(leadId, ts);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
