export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { killUser } from "@/lib/fraud";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { role, restore, kill, markReviewed, clearFlag, riskStatus } = body;

  if (role && !["user", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Post-hoc fraud enforcement: pause everything, void the trial, mark banned,
  // and record the device/IP so future signups from it surface as high risk.
  if (kill === true) {
    await killUser(id, "admin_kill");
  }

  const updateData: Record<string, string | Date | null> = {};
  if (role) updateData.role = role;
  if (restore === true) updateData.deletedAt = null;
  if (markReviewed === true) {
    updateData.riskStatus = "reviewed";
    updateData.reviewedAt = new Date();
  }
  if (clearFlag === true) {
    updateData.riskStatus = "none";
    updateData.reviewedAt = null;
  }
  if (riskStatus && ["none", "flagged", "reviewed", "banned"].includes(riskStatus)) {
    updateData.riskStatus = riskStatus;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      deletedAt: true,
      riskStatus: true,
      trialVoided: true,
    },
  });

  return NextResponse.json({ user: updated });
}
