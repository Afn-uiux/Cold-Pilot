export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SAFE_FIELDS = [
  "id", "email", "provider", "smtpHost", "smtpPort", "imapHost", "imapPort",
  "displayName", "status", "healthScore", "healthState", "lastUsedAt", "note",
  "tags", "filterTag",
  "dailyTarget", "warmupBase", "warmupIncrease", "warmupStartedAt",
  "scheduleStart", "scheduleEnd", "minWaitMinutes",
  "replyRate", "openRate", "spamProtection", "markImportant",
  "createdAt", "updatedAt",
];

function sanitize(seed: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of SAFE_FIELDS) {
    if (f in seed) out[f] = seed[f];
  }
  return out;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const seed = await prisma.seedInbox.findUnique({ where: { id } });
  if (!seed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Warmup stats for last 7 calendar days (today minus 6 days at midnight).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Warmup runs in both directions for a seed too: the seed sent emails
  // (senderInboxId) AND the seed network sent emails into it (seedInboxId).
  const warmupLogs = await prisma.warmupLog.findMany({
    where: {
      OR: [{ senderInboxId: id }, { seedInboxId: id }],
      sentAt: { gte: sevenDaysAgo },
    },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true, receivedAt: true, rescuedFromSpam: true, status: true, senderInboxId: true, seedInboxId: true },
  });

  const sentLogs = warmupLogs.filter(l => l.senderInboxId === id && (l.status === "sent" || l.status === "delivered"));
  const recvLogs = warmupLogs.filter(l => l.seedInboxId === id && (l.status === "sent" || l.status === "delivered"));

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const daily: { date: string; label: string; sent: number; received: number; rescued: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const daySent = sentLogs.filter(l => l.sentAt && l.sentAt >= d && l.sentAt < next);
    const dayRecv = recvLogs.filter(l => l.sentAt && l.sentAt >= d && l.sentAt < next);
    daily.push({
      date: d.toISOString().slice(0, 10),
      label: dayLabels[d.getDay() === 0 ? 6 : d.getDay() - 1] || dayLabels[d.getDay()],
      sent: daySent.length,
      received: dayRecv.length,
      rescued: daySent.filter(l => l.rescuedFromSpam).length + dayRecv.filter(l => l.rescuedFromSpam).length,
    });
  }

  const warmupReceived = recvLogs.length;
  const warmupSent = sentLogs.length;
  const savedFromSpam = sentLogs.filter(l => l.rescuedFromSpam).length + recvLogs.filter(l => l.rescuedFromSpam).length;

  return NextResponse.json({
    seed: sanitize(seed as any),
    warmup: { daily, summary: { warmupReceived, warmupSent, savedFromSpam } },
  });
}