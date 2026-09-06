export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 200, 1), 1000);

  const where = q
    ? { OR: [{ email: { contains: q } }, { ip: { contains: q } }, { reason: { contains: q } }] }
    : {};

  const [attempts, totals] = await Promise.all([
    prisma.loginAttempt.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.loginAttempt.groupBy({ by: ["reason"], _count: { _all: true } }),
  ]);

  const counts = {
    success: 0,
    invalid: 0,
    throttled: 0,
    missing: 0,
    error: 0,
  };
  for (const t of totals) {
    const key = t.reason as string;
    (counts as Record<string, number>)[key] = t._count._all;
  }

  return NextResponse.json({
    attempts: attempts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    counts,
  });
}