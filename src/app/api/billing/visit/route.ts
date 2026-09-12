export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Records that the user opened the Billing tab (or clicked an upgrade CTA).
// Only stamps the timestamp — no data is sent. BillingSection fires this once
// per mount, and sweepBillingFollowUps uses the most recent visit to find free
// users who explored billing but never subscribed, then emails the founder
// follow-up. Idempotent enough: repeated visits just move the timestamp later.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastBillingVisitAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}