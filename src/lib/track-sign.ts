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

function payload(leadId: string, stepId: string | undefined, url: string): string {
  return `${leadId}:${stepId || ""}:${url}`;
}

// Signs the (leadId, stepId, destination url) triple so /api/track can prove
// a click-tracking redirect target is the one this app actually generated,
// instead of blindly trusting whatever `redirect` shows up in the request.
export function signRedirect(leadId: string, stepId: string | undefined, url: string): string {
  return createHmac("sha256", getKey()).update(payload(leadId, stepId, url)).digest("hex");
}

export function verifyRedirect(
  leadId: string,
  stepId: string | undefined,
  url: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const expected = signRedirect(leadId, stepId, url);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Signs the (leadId) triple for the unsubscribe link so a recipient can only
// unsubscribe a lead whose token they actually hold, and so one lead's token
// cannot be replayed against another.
export function signUnsubscribe(leadId: string): string {
  return createHmac("sha256", getUnsubscribeKey()).update(leadId).digest("hex");
}

export function verifyUnsubscribe(leadId: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signUnsubscribe(leadId);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
