export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const search = req.nextUrl.searchParams.get("search") || "";
  const status = req.nextUrl.searchParams.get("status") || "all";
  const flag = req.nextUrl.searchParams.get("flag") || "all";
  const plan = req.nextUrl.searchParams.get("plan") || "all";

  const where: Record<string, unknown> = {};
  if (status === "deleted") where.deletedAt = { not: null };
  else if (status === "active") where.deletedAt = null;
  if (plan === "free") where.plan = "free";
  else if (plan === "paid") where.plan = { not: "free" };

  const ors: Record<string, unknown>[] = [];
  if (search) {
    ors.push(
      { name: { contains: search } },
      { email: { contains: search } }
    );
  }
  if (flag === "flagged") {
    ors.push({ riskStatus: { in: ["flagged", "banned"] } });
    ors.push({ trialVoided: true });
  }
  if (ors.length > 0) where.OR = ors;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      deletedAt: true,
      riskScore: true,
      riskFlags: true,
      riskStatus: true,
      trialVoided: true,
      trialVoidReason: true,
      signupIp: true,
      signupCountry: true,
      signupSource: true,
      deviceFingerprint: true,
      reviewedAt: true,
      plan: true,
      creditBalance: true,
      trialEndsAt: true,
      bachsSubscriptionId: true,
      _count: { select: { campaigns: true, leads: true, emailAccounts: true } },
    },
  });

  return NextResponse.json({ users });
}
