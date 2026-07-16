import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const IMAP_DEFAULTS: Record<string, { host: string; port: number }> = {
  gmail: { host: "imap.gmail.com", port: 993 },
  outlook: { host: "outlook.office365.com", port: 993 },
  yahoo: { host: "imap.mail.yahoo.com", port: 993 },
  proton: { host: "127.0.0.1", port: 1143 },
};

function providerFromEmail(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail")) return "gmail";
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return "outlook";
  if (domain.includes("yahoo")) return "yahoo";
  if (domain.includes("proton")) return "proton";
  return "other";
}

function generateFilterTag(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let tag = "";
  for (let i = 0; i < 6; i++) tag += chars[Math.floor(Math.random() * chars.length)];
  return tag;
}

function deriveImapConfig(email: string, imapHost?: string, imapPort?: number, smtpHost?: string) {
  const provider = providerFromEmail(email);
  if (imapHost) return { imapHost, imapPort: imapPort || 993, provider };
  const defaults = IMAP_DEFAULTS[provider];
  if (defaults) return { imapHost: defaults.host, imapPort: imapPort || defaults.port, provider };
  const guessed = smtpHost?.replace(/^smtp\./, "imap.") || smtpHost || "";
  return { imapHost: guessed, imapPort: imapPort || 993, provider };
}

const SAFE_FIELDS = {
  id: true, userId: true, email: true, provider: true,
  smtpHost: true, smtpPort: true, smtpUser: true,
  imapHost: true, imapPort: true, imapUser: true,
  displayName: true, domain: true,
  warmupEnabled: true, warmupBase: true, warmupIncrease: true, warmupMax: true,
  warmupDays: true, warmupFilterTag: true, disableSlowWarmup: true, warmupReplyRate: true, readEmulation: true, warmupOpenRate: true, warmupSpamProtection: true, warmupMarkImportant: true, customTrackingDomain: true, warmupCustomTrackingDomain: true, warmupStartTime: true, warmupEndTime: true,
  minWaitTime: true, timezone: true, warmupPoolType: true,
  warmupAiEnabled: true, healthScore: true, healthState: true,
  isPaused: true, warmupWeek: true, currentDailyVolume: true,
  targetDailyVolume: true, dailySendLimit: true,
  warmupStartedAt: true, lastHealthCheckAt: true,
  status: true, createdAt: true, updatedAt: true,
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const detail = url.searchParams.get("detail");

  if (id && detail === "true") {
    const account = await prisma.emailAccount.findFirst({
      where: { id, userId: session.user.id },
      select: SAFE_FIELDS,
    });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalSent = await prisma.emailLog.count({
      where: { emailAccountId: id, type: "outgoing" },
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = await prisma.emailLog.count({
      where: { emailAccountId: id, type: "outgoing", sentAt: { gte: today } },
    });
    const replies = await prisma.emailLog.count({
      where: { emailAccountId: id, repliedAt: { not: null } },
    });
    const campaignCount = await prisma.campaign.count({
      where: { userId: session.user.id, accountIds: { contains: id } },
    });
    const recentLogs = await prisma.emailLog.findMany({
      where: { emailAccountId: id },
      orderBy: { sentAt: "desc" },
      take: 5,
      include: { lead: { select: { email: true, firstName: true, lastName: true } } },
    });

    // Warmup stats for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const warmupLogs = await prisma.warmupLog.findMany({
      where: { senderMailboxId: id, sentAt: { gte: sevenDaysAgo } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true, receivedAt: true, rescuedFromSpam: true, status: true },
    });

    // Build daily aggregates
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const daily: { date: string; label: string; sent: number; received: number; rescued: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayLogs = warmupLogs.filter(l => l.sentAt && l.sentAt >= d && l.sentAt < next);
      daily.push({
        date: d.toISOString().slice(0, 10),
        label: dayLabels[d.getDay() === 0 ? 6 : d.getDay() - 1] || dayLabels[d.getDay()],
        sent: dayLogs.length,
        received: dayLogs.filter(l => l.status === "received" || l.receivedAt).length,
        rescued: dayLogs.filter(l => l.rescuedFromSpam).length,
      });
    }

    // Warmup summary
    const warmupReceived = warmupLogs.filter(l => l.status === "received" || l.receivedAt).length;
    const warmupSent = warmupLogs.length;
    const savedFromSpam = warmupLogs.filter(l => l.rescuedFromSpam).length;

    const campaigns = await prisma.campaign.findMany({
      where: { userId: session.user.id, accountIds: { contains: id }, deletedAt: null },
      select: { id: true, name: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      account,
      stats: { totalSent, sentToday, replies, campaignCount },
      recentLogs,
      warmup: { daily, summary: { warmupReceived, warmupSent, savedFromSpam } },
      campaigns,
    });
  }

  const accounts = await prisma.emailAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { ...SAFE_FIELDS, _count: { select: { emailLogs: true } } },
  });

  return NextResponse.json(
    accounts.map(a => {
      const { _count, ...rest } = a as any;
      return { ...rest, sent: _count?.emailLogs ?? 0 };
    })
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { email, provider, smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass, gmailToken, dailySendLimit, displayName } = body;

  if (!email || !provider) return NextResponse.json({ error: "Email and provider are required" }, { status: 400 });

  const existing = await prisma.emailAccount.findFirst({
    where: { email, userId: session.user.id },
  });
  if (existing) return NextResponse.json({ error: "This email is already connected" }, { status: 409 });

  const finalImapPort = imapPort ? parseInt(String(imapPort)) : undefined;
  const { imapHost: derivedImapHost, imapPort: derivedImapPortNum, provider: seedProvider } = deriveImapConfig(email, imapHost, finalImapPort, smtpHost);
  const finalImapPortVal = finalImapPort || derivedImapPortNum;
  const finalImapUser = imapUser || smtpUser;
  const finalImapPass = imapPass || smtpPass;
  const finalImapHost = imapHost || derivedImapHost;

  const account = await prisma.emailAccount.create({
    data: {
      email, provider,
      displayName: displayName || null,
      smtpHost: smtpHost || null, smtpPort: smtpPort ? parseInt(smtpPort) : null,
      smtpUser: smtpUser || null, smtpPass: smtpPass || null,
      imapHost: finalImapHost || null, imapPort: finalImapPortVal ? parseInt(String(finalImapPortVal)) : null,
      imapUser: finalImapUser || null, imapPass: finalImapPass || null,
      gmailToken: gmailToken || null,
      dailySendLimit: dailySendLimit || 50,
      warmupEnabled: provider === "Gmail",
      warmupFilterTag: generateFilterTag(),
      userId: session.user.id,
    },
  });

  if (finalImapHost && finalImapUser && finalImapPass) {
    await prisma.seedMailbox.upsert({
      where: { email },
      update: {
        smtpHost: smtpHost || "", smtpPort: smtpPort ? parseInt(String(smtpPort)) : 465,
        smtpUser: smtpUser || "", smtpPass: smtpPass || "",
        imapHost: finalImapHost, imapPort: finalImapPortVal,
        imapUser: finalImapUser, imapPass: finalImapPass,
        provider: seedProvider, isActive: true,
      },
      create: {
        email, userId: session.user.id,
        smtpHost: smtpHost || "", smtpPort: smtpPort ? parseInt(String(smtpPort)) : 465,
        smtpUser: smtpUser || "", smtpPass: smtpPass || "",
        imapHost: finalImapHost, imapPort: finalImapPortVal,
        imapUser: finalImapUser, imapPass: finalImapPass,
        provider: seedProvider, isActive: true,
      },
    });
  }

  return NextResponse.json(account);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Account ID required" }, { status: 400 });

  const account = await prisma.emailAccount.findFirst({ where: { id, userId: session.user.id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Handle settings update
  const allowedSettings = [
    "displayName", "dailySendLimit", "minWaitTime", "timezone",
    "warmupEnabled", "warmupBase", "warmupIncrease", "warmupMax",
    "warmupDays", "warmupFilterTag", "disableSlowWarmup", "warmupReplyRate", "readEmulation", "warmupOpenRate", "warmupSpamProtection", "warmupMarkImportant", "customTrackingDomain", "warmupCustomTrackingDomain", "warmupStartTime", "warmupEndTime",
    "warmupPoolType", "warmupAiEnabled", "status",
    "smtpHost", "smtpPort", "smtpUser", "smtpPass",
    "imapHost", "imapPort", "imapUser", "imapPass",
  ];

  const updateData: Record<string, any> = {};
  for (const key of allowedSettings) {
    if (body[key] !== undefined) {
      if (key === "smtpPort" || key === "imapPort" || key === "dailySendLimit" || key === "minWaitTime" || key === "warmupBase" || key === "warmupIncrease" || key === "warmupMax" || key === "warmupDays") {
        updateData[key] = parseInt(String(body[key]));
      } else {
        updateData[key] = body[key];
      }
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.emailAccount.update({ where: { id }, data: updateData });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Account ID required" }, { status: 400 });

    const account = await prisma.emailAccount.findFirst({ where: { id, userId: session.user.id } });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.seedMailbox.deleteMany({ where: { email: account.email, userId: session.user.id } });
    await prisma.warmupLog.deleteMany({ where: { senderMailboxId: id } });
    await prisma.emailAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete" }, { status: 500 });
  }
}
