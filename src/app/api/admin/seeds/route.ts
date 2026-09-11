export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptAccount } from "@/lib/crypto";
import { parseSeedTags, stringifySeedTags, generateFilterTag } from "@/lib/seed-tags";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: { error: "Unauthorized" }, status: 401 } as const;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return { error: { error: "Forbidden" }, status: 403 } as const;
  return { session, error: null } as const;
}

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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json(guard.error, { status: guard.status });

  const status = req.nextUrl.searchParams.get("status") || "all";
  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;

  const seeds = await prisma.seedInbox.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  // Aggregate warmup activity per seed. Sent = this seed sent; received =
  // this seed received (seedInboxId); replied = it replied; rescued = warmup
  // emails THIS seed SENT that landed in spam and were rescued by the
  // recipient — the sender-reputation signal, same as the health score and
  // the user-facing saved-from-spam analytics.
  const [sentToday, sentWeek, receivedToday, receivedWeek, repliedToday, repliedWeek, rescuedToday, rescuedWeek] =
    await Promise.all([
      prisma.warmupLog.groupBy({ by: ["senderInboxId"], _count: { id: true }, where: { senderInboxId: { in: seeds.map(s => s.id) }, sentAt: { gte: startOfToday } } }),
      prisma.warmupLog.groupBy({ by: ["senderInboxId"], _count: { id: true }, where: { senderInboxId: { in: seeds.map(s => s.id) }, sentAt: { gte: startOfWeek } } }),
      prisma.warmupLog.groupBy({ by: ["seedInboxId"], _count: { id: true }, where: { seedInboxId: { in: seeds.map(s => s.id) }, receivedAt: { gte: startOfToday } } }),
      prisma.warmupLog.groupBy({ by: ["seedInboxId"], _count: { id: true }, where: { seedInboxId: { in: seeds.map(s => s.id) }, receivedAt: { gte: startOfWeek } } }),
      prisma.warmupLog.groupBy({ by: ["seedInboxId"], _count: { id: true }, where: { seedInboxId: { in: seeds.map(s => s.id) }, repliedAt: { gte: startOfToday } } }),
      prisma.warmupLog.groupBy({ by: ["seedInboxId"], _count: { id: true }, where: { seedInboxId: { in: seeds.map(s => s.id) }, repliedAt: { gte: startOfWeek } } }),
      prisma.warmupLog.groupBy({ by: ["senderInboxId"], _count: { id: true }, where: { senderInboxId: { in: seeds.map(s => s.id) }, rescuedFromSpam: true, sentAt: { gte: startOfToday } } }),
      prisma.warmupLog.groupBy({ by: ["senderInboxId"], _count: { id: true }, where: { senderInboxId: { in: seeds.map(s => s.id) }, rescuedFromSpam: true, sentAt: { gte: startOfWeek } } }),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapTo(map: any[], key: string) {
    const m: Record<string, number> = {};
    for (const row of map) { const k = row[key]; if (k) m[k] = row._count.id; }
    return m;
  }
  const stats = {
    sentToday: mapTo(sentToday, "senderInboxId"),
    sentWeek: mapTo(sentWeek, "senderInboxId"),
    receivedToday: mapTo(receivedToday, "seedInboxId"),
    receivedWeek: mapTo(receivedWeek, "seedInboxId"),
    repliedToday: mapTo(repliedToday, "seedInboxId"),
    repliedWeek: mapTo(repliedWeek, "seedInboxId"),
    rescuedToday: mapTo(rescuedToday, "senderInboxId"),
    rescuedWeek: mapTo(rescuedWeek, "senderInboxId"),
  };

  const list = seeds.map(s => ({ ...sanitize(s as any), stats: {
    sentToday: stats.sentToday[s.id] || 0,
    sentWeek: stats.sentWeek[s.id] || 0,
    receivedToday: stats.receivedToday[s.id] || 0,
    receivedWeek: stats.receivedWeek[s.id] || 0,
    repliedToday: stats.repliedToday[s.id] || 0,
    repliedWeek: stats.repliedWeek[s.id] || 0,
    rescuedToday: stats.rescuedToday[s.id] || 0,
    rescuedWeek: stats.rescuedWeek[s.id] || 0,
  }}));

  return NextResponse.json({ seeds: list });
}

// Collision-checked tracking code: explicit choice wins, otherwise mint one.
// Retries minting on the (astronomically unlikely) collision.
async function uniqueFilterTag(explicit: string | null): Promise<string> {
  if (explicit) {
    const clash = await prisma.seedInbox.findFirst({ where: { filterTag: explicit } });
    if (!clash) return explicit;
  }
  for (let i = 0; i < 5; i++) {
    const tag = generateFilterTag();
    const clash = await prisma.seedInbox.findFirst({ where: { filterTag: tag } });
    if (!clash) return tag;
  }
  return `${generateFilterTag()}${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json(guard.error, { status: guard.status });

  const body = await req.json();
  const {
    email, provider, smtpHost, smtpPort, smtpUser, smtpPass,
    imapHost, imapPort, imapUser, imapPass, gmailToken, displayName, tags, filterTag,
  } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existing = await prisma.seedInbox.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A seed with that email already exists" }, { status: 409 });
  }

  const data: Record<string, any> = {
    email,
    provider: provider || "other",
    smtpHost: smtpHost || null,
    smtpPort: smtpPort ? Number(smtpPort) : null,
    smtpUser: smtpUser || null,
    smtpPass: smtpPass || null,
    imapHost: imapHost || null,
    imapPort: imapPort ? Number(imapPort) : null,
    imapUser: imapUser || null,
    imapPass: imapPass || null,
    gmailToken: gmailToken || null,
    displayName: displayName || null,
    tags: stringifySeedTags(parseSeedTags(tags ?? [])),
    // Like user mailboxes: every seed gets its own tracking code at link
    // time (collision-checked), admin-editable afterwards.
    filterTag: await uniqueFilterTag(
      typeof filterTag === "string" && filterTag.trim() ? filterTag.trim().slice(0, 30) : null
    ),
    warmupStartedAt: new Date(),
  };

  const seed = await prisma.seedInbox.create({
    data: encryptAccount(data) as any,
  });
  return NextResponse.json({ seed: sanitize(seed as any) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json(guard.error, { status: guard.status });

  const body = await req.json();
  const { id, status, note } = body;
  if (!id) return NextResponse.json({ error: "Seed id is required" }, { status: 400 });

  const data: Record<string, any> = {};
  if (status) data.status = status; // active | paused | quarantined
  if (note !== undefined) data.note = note;
  if (body.tags !== undefined) data.tags = stringifySeedTags(parseSeedTags(body.tags));
  if (body.filterTag !== undefined && typeof body.filterTag === "string" && body.filterTag.trim()) {
    data.filterTag = await uniqueFilterTag(body.filterTag.trim().slice(0, 30));
  }
  for (const f of ["dailyTarget", "warmupBase", "warmupIncrease", "replyRate", "openRate", "spamProtection", "markImportant", "minWaitMinutes"]) {
    if (body[f] !== undefined) data[f] = Number(body[f]);
  }
  for (const f of ["scheduleStart", "scheduleEnd"]) {
    if (body[f] !== undefined && typeof body[f] === "string") data[f] = body[f];
  }

  try {
    const seed = await prisma.seedInbox.update({ where: { id }, data });
    return NextResponse.json({ seed: sanitize(seed as any) });
  } catch {
    return NextResponse.json({ error: "Seed not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json(guard.error, { status: guard.status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Seed id is required" }, { status: 400 });

  try {
    await prisma.seedInbox.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Seed not found" }, { status: 404 });
  }
}
