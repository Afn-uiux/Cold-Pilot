export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json(guard.error, { status: guard.status });

  const userId = req.nextUrl.searchParams.get("userId");

  // Single conversation thread.
  if (userId) {
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, byAdmin: true, content: true, createdAt: true },
    });
    let aiDisabled = false;
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "ChatSettings" ("userId" TEXT NOT NULL PRIMARY KEY, "aiDisabled" BOOLEAN NOT NULL DEFAULT false, "updatedAt" DATETIME NOT NULL)`
      );
      const settings = await prisma.chatSettings.findUnique({
        where: { userId },
        select: { aiDisabled: true },
      });
      aiDisabled = settings?.aiDisabled ?? false;
    } catch {
      // Default to AI on.
    }
    return NextResponse.json({ messages, aiDisabled });
  }

  // Conversation list: every user with at least one message, with the most
  // recent message and times. Built from one messages query so the ordering is
  // exact regardless of volume.
  const [messages, usersRaw] = await Promise.all([
    prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      select: { userId: true, role: true, byAdmin: true, content: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { chatMessages: { some: {} } },
      select: { id: true, name: true, email: true, plan: true, deletedAt: true, trialEndsAt: true },
    }),
  ]);

  const users = new Map(usersRaw.map((u) => [u.id, u]));
  const byUser = new Map<string, { lastMessage: string; lastRole: string; lastByAdmin: boolean; lastAt: string; count: number }>();
  for (const m of messages) {
    const entry = byUser.get(m.userId);
    if (!entry) {
      byUser.set(m.userId, {
        lastMessage: m.content,
        lastRole: m.role,
        lastByAdmin: m.byAdmin,
        lastAt: m.createdAt.toISOString(),
        count: 1,
      });
    } else {
      entry.count += 1;
    }
  }

  const conversations = [...byUser.entries()]
    .map(([id, m]) => {
      const u = users.get(id);
      return {
        userId: id,
        email: u?.email ?? "(deleted user)",
        name: u?.name ?? null,
        plan: u?.plan ?? null,
        deletedAt: u?.deletedAt?.toISOString() ?? null,
        count: m.count,
        lastMessage: m.lastMessage,
        lastRole: m.lastRole,
        lastByAdmin: m.lastByAdmin,
        lastAt: m.lastAt,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json(guard.error, { status: guard.status });

  const body = await req.json();

  // Toggle AI on/off for a conversation.
  if (typeof body.userId === "string" && typeof body.aiDisabled === "boolean") {
    const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    try {
      await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "ChatSettings" ("userId" TEXT NOT NULL PRIMARY KEY, "aiDisabled" BOOLEAN NOT NULL DEFAULT false, "updatedAt" DATETIME NOT NULL)`;
      await prisma.chatSettings.upsert({
        where: { userId: body.userId },
        update: { aiDisabled: body.aiDisabled },
        create: { userId: body.userId, aiDisabled: body.aiDisabled },
      });
    } catch (e) {
      console.error("[admin-chat] toggle AI failed:", e);
      return NextResponse.json({ error: "Failed to toggle AI", detail: String(e) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, aiDisabled: body.aiDisabled });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!userId || !content) {
    return NextResponse.json({ error: "userId and content are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const message = await prisma.chatMessage.create({
    data: { userId, role: "assistant", byAdmin: true, content },
    select: { id: true, role: true, byAdmin: true, content: true, createdAt: true },
  });
  return NextResponse.json({ message }, { status: 201 });
}