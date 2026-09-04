import { prisma } from "./prisma";

// Shared bad-lead registry (platform memory). Rules:
// - ONLY definitive verdicts are stored: hard bounces and mailbox_not_found
//   verifications. Risky/unknown/greylisted must never enter (uncertainty
//   about one user's lead must not block another user's good address).
// - Rows expire (dead addresses get recycled by providers). Re-hits refresh.
// - Helpers never throw: intel is an accelerator, and a registry hiccup must
//   not break verification, sending, or imports.

export const INTEL_TTL_DAYS = 270;

// Verification reasons definitive enough to share globally. Everything else
// (catch-all, greylist, timeouts, full mailboxes) stays per-user.
export const DEFINITIVE_VERIFY_REASONS = new Set(["mailbox_not_found"]);

function expiryDate(): Date {
  return new Date(Date.now() + INTEL_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function rememberBadLead(
  email: string,
  reason: "mailbox_not_found" | "hard_bounce",
  source: "verification" | "bounce",
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes("@")) return;
  try {
    await prisma.globalLeadIntel.upsert({
      where: { email: normalized },
      update: {
        hitCount: { increment: 1 },
        lastSeenAt: new Date(),
        expiresAt: expiryDate(),
        // Latest definitive verdict wins (a hard bounce overrules an older
        // verification record and vice versa — both mean "do not send").
        reason,
        source,
      },
      create: {
        email: normalized,
        verdict: "invalid",
        reason,
        source,
        expiresAt: expiryDate(),
      },
    });
  } catch (err) {
    console.error("[global-intel] remember failed", normalized, err);
  }
}

export interface GlobalIntelHit {
  reason: string;
  source: string;
  hitCount: number;
  lastSeenAt: Date;
}

export async function checkGlobalIntel(email: string): Promise<GlobalIntelHit | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;
  try {
    const row = await prisma.globalLeadIntel.findUnique({ where: { email: normalized } });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return { reason: row.reason, source: row.source, hitCount: row.hitCount, lastSeenAt: row.lastSeenAt };
  } catch (err) {
    console.error("[global-intel] check failed", normalized, err);
    return null;
  }
}

// Batch version for imports: one query for N emails, returns the subset
// already proven bad (and unexpired). Used to stamp leads at import time so
// known-dead addresses never enter a campaign as "unverified".
export async function checkGlobalIntelMany(emails: string[]): Promise<Set<string>> {
  const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter((e) => e.includes("@")))];
  if (normalized.length === 0) return new Set();
  try {
    const rows = await prisma.globalLeadIntel.findMany({
      where: { email: { in: normalized }, expiresAt: { gt: new Date() } },
      select: { email: true },
    });
    return new Set(rows.map((r) => r.email));
  } catch (err) {
    console.error("[global-intel] batch check failed", err);
    return new Set();
  }
}
