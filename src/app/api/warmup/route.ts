export const runtime = "nodejs";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { NextResponse } from "next/server";
import { reconcileWarmupSchedules, processDueWarmupSends, saveHealthLog } from "@/engine/warmup";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { emailAccountId, action } = body;

  const account = await prisma.emailAccount.findFirst({
    where: { id: emailAccountId, userId: session.user.id },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  switch (action) {
    case "toggle": {
      // Trial users get full access until the trial expires (enforced by
      // trialGuard above); expired/voided trials are already blocked there.
      const enabled = !account.warmupEnabled;

      // Warmup requires a real sending identity. OAuth-only accounts have no
      // app password (smtpPass), so they can send nothing — never enable
      // warmup for them.
      if (enabled) {
        const decrypted = decryptAccount(account);
        if (!decrypted.smtpPass || !decrypted.smtpUser) {
          return NextResponse.json(
            {
              error:
                "This account is connected without an app password. Add your Gmail/Outlook app password to enable warmup.",
            },
            { status: 400 },
          );
        }
      }

      const updated = await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          warmupEnabled: enabled,
          // Re-enabling warmup revokes any auto/manual pause so the account
          // resumes — otherwise a previously paused mailbox stays frozen even
          // after the owner fixes their credentials and flips it back on.
          isPaused: enabled ? false : undefined,
          warmupStartedAt: enabled ? (account.warmupStartedAt || new Date()) : undefined,
        },
      });
      return NextResponse.json({ warmupEnabled: updated.warmupEnabled });
    }

    case "settings": {
      const {
        warmupBase, warmupIncrease, warmupMax, warmupDays,
        warmupStartTime, warmupEndTime, minWaitTime, timezone,
        targetDailyVolume,
      } = body;

      const data: Record<string, any> = {};
      if (warmupBase !== undefined) data.warmupBase = warmupBase;
      if (warmupIncrease !== undefined) data.warmupIncrease = warmupIncrease;
      if (warmupMax !== undefined) data.warmupMax = warmupMax;
      if (warmupDays !== undefined) data.warmupDays = warmupDays;
      if (warmupStartTime !== undefined) data.warmupStartTime = warmupStartTime;
      if (warmupEndTime !== undefined) data.warmupEndTime = warmupEndTime;
      if (minWaitTime !== undefined) data.minWaitTime = minWaitTime;
      if (timezone !== undefined) data.timezone = timezone;
      if (targetDailyVolume !== undefined) data.targetDailyVolume = targetDailyVolume;


      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data,
      });
      return NextResponse.json({ success: true });
    }

    case "tick": {
      // Global warmup processing must not be triggerable by any authenticated
      // user — that would let a single tenant run (and load) the warmup engine
      // for every account in the product. Cron-secret only, constant-time
      // compare, fail-closed when the secret is unset.
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = req.headers.get("authorization");
      const expected = cronSecret ? `Bearer ${cronSecret}` : "";
      const a = Buffer.from(authHeader || "");
      const b = Buffer.from(expected);
      const authorized = a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
      if (!cronSecret || !authorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { sent, failed } = await processDueWarmupSends();
      const seeded = await reconcileWarmupSchedules();
      return NextResponse.json({ sent, failed, seeded });
    }

    case "health": {
      // Belt-and-braces ownership check: the handler entry already gates on
      // (id, userId), this re-asserts it at the point of the state-changing
      // write so a future refactor of the entry gate can't silently open an
      // IDOR on another tenant's mailbox health.
      const account = await prisma.emailAccount.findFirst({
        where: { id: emailAccountId, userId: session.user.id },
        select: { id: true },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      await saveHealthLog(emailAccountId);
      const updated = await prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
        select: { healthScore: true, healthState: true, isPaused: true },
      });
      return NextResponse.json(updated);
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const emailAccountId = url.searchParams.get("accountId");

  if (emailAccountId) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: emailAccountId, userId: session.user.id },
      select: {
        id: true, email: true, warmupEnabled: true, warmupBase: true,
        warmupIncrease: true, warmupMax: true, warmupDays: true,
        warmupStartTime: true, warmupEndTime: true, minWaitTime: true,
        timezone: true, healthScore: true,
        healthState: true, isPaused: true, warmupWeek: true,
        currentDailyVolume: true, targetDailyVolume: true,
        warmupStartedAt: true, lastHealthCheckAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Get stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [sentToday, sentTotal, spamCount, replyCount, scheduledCount] = await Promise.all([
      prisma.warmupLog.count({ where: { senderMailboxId: emailAccountId, sentAt: { gte: todayStart }, status: "sent" } }),
      prisma.warmupLog.count({ where: { senderMailboxId: emailAccountId, status: "sent" } }),
      prisma.warmupLog.count({ where: { senderMailboxId: emailAccountId, foundInSpam: true } }),
      prisma.warmupLog.count({ where: { senderMailboxId: emailAccountId, replyReceived: true } }),
      prisma.warmupLog.count({ where: { senderMailboxId: emailAccountId, status: "scheduled" } }),
    ]);

    return NextResponse.json({
      ...account,
      stats: { sentToday, sentTotal, spamCount, replyCount, scheduledCount },
    });
  }

  // List all accounts with warmup info
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: {
      id: true, email: true, warmupEnabled: true, healthScore: true,
      healthState: true, isPaused: true, currentDailyVolume: true,
      targetDailyVolume: true, warmupWeek: true, status: true,
    },
  });

  return NextResponse.json(accounts);
}