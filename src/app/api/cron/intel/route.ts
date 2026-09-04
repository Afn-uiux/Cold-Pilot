export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Daily platform-memory maintenance. Trigger with:
//   GET /api/cron/intel  Authorization: Bearer <CRON_SECRET>
// Jobs:
// 1. Purge expired registry rows (dead addresses get recycled by providers;
//    an entry that hasn't been re-confirmed within its TTL must not block
//    sends forever).
// 2. Backfill: stamp still-unverified leads that match live registry entries
//    as invalid (covers leads imported before the registry existed, or via
//    paths that skip import-time stamping). Batched to 500/day.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const expected = cronSecret ? `Bearer ${cronSecret}` : "";
  const a = Buffer.from(authHeader || "");
  const b = Buffer.from(expected);
  const authorized = a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  if (!cronSecret || !authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    const purged = await prisma.globalLeadIntel.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    results.purgedExpired = purged.count;
  } catch (err: any) {
    results.purgedExpired = { error: err?.message || String(err) };
  }

  try {
    const candidates = await prisma.lead.findMany({
      where: { deletedAt: null, OR: [{ verificationStatus: null }, { verificationStatus: "unverified" }] },
      take: 500,
      select: { id: true, email: true },
    });
    const emails = [...new Set(candidates.map((l) => l.email.toLowerCase().trim()))];
    let stamped = 0;
    if (emails.length > 0) {
      const known = await prisma.globalLeadIntel.findMany({
        where: { email: { in: emails }, expiresAt: { gt: new Date() } },
        select: { email: true },
      });
      const knownSet = new Set(known.map((k) => k.email));
      const ids = candidates.filter((l) => knownSet.has(l.email.toLowerCase().trim())).map((l) => l.id);
      if (ids.length > 0) {
        const updated = await prisma.lead.updateMany({
          where: { id: { in: ids } },
          data: { verificationStatus: "invalid", verificationReason: "known_bad_global", verifiedAt: new Date() },
        });
        stamped = updated.count;
      }
    }
    results.backfilled = { checked: candidates.length, stamped };
  } catch (err: any) {
    results.backfilled = { error: err?.message || String(err) };
  }

  try {
    const total = await prisma.globalLeadIntel.count({ where: { expiresAt: { gt: new Date() } } });
    results.liveEntries = total;
  } catch (err: any) {
    results.liveEntries = { error: err?.message || String(err) };
  }

  return NextResponse.json({ success: true, ...results });
}
