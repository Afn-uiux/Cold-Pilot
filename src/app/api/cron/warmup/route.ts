export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { enqueueJob } from "@/lib/queue";
import { processDueWarmupSends, reconcileWarmupSchedules, processSeedInboxes } from "@/engine/warmup";

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

  const useQueue = process.env.REDIS_URL && process.env.REDIS_URL.startsWith("redis");

  if (useQueue) {
    await Promise.all([
      enqueueJob("warmup", { type: "sends" }),
      enqueueJob("warmup", { type: "reconcile" }),
      enqueueJob("warmup", { type: "imap" }),
    ]);
    return NextResponse.json({ success: true, queued: true });
  }

  const results: Record<string, any> = {};

  try {
    const { sent, failed } = await processDueWarmupSends();
    results.sends = { sent, failed };
  } catch (err: any) {
    results.sends = { error: err.message };
  }

  try {
    const seeded = await reconcileWarmupSchedules();
    results.seeded = { count: seeded };
  } catch (err: any) {
    results.seeded = { error: err.message };
  }

  try {
    const imap = await processSeedInboxes();
    results.imap = imap;
  } catch (err: any) {
    results.imap = { error: err.message };
  }

  return NextResponse.json({ success: true, queued: false, ...results });
}
