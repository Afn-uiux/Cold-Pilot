export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    await prisma.$transaction([
      prisma.campaign.updateMany({
        where: { userId, status: "active", deletedAt: null },
        data: { status: "paused" },
      }),
      prisma.emailAccount.updateMany({
        where: { userId, status: "active" },
        data: { status: "paused" },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Failed to delete account:", e);
    return NextResponse.json({ error: "Failed to delete account. Please try again." }, { status: 500 });
  }
}
