export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyToken as verifyTotp } from "@/lib/totp";

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Deleting an account is irreversible (campaigns/leads/notifications
  // cascade). Prove control with the current password OR a valid 2FA code,
  // so a stolen session cookie alone can never destroy an account (audit
  // M-7).
  let currentPassword: string | undefined;
  let code: string | undefined;
  try {
    const body = await req.json();
    currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : undefined;
    code = typeof body.code === "string" ? body.code : undefined;
  } catch {}

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, totpSecret: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const passwordOk = !!(user.password && currentPassword && (await bcrypt.compare(currentPassword, user.password)));
  if (user.password && !passwordOk) {
    return NextResponse.json({ error: "Current password is required to delete your account" }, { status: 403 });
  }
  if (user.totpSecret) {
    if (!code || !verifyTotp(user.totpSecret, code)) {
      return NextResponse.json({ error: "A valid 2FA code is required to delete your account" }, { status: 403 });
    }
  }
  if (!user.password && !user.totpSecret) {
    // Passwordless account with no 2FA: a session is the only factor, which is
    // exactly the case a session thief could ride. Require the owner to add a
    // password (or 2FA) before destruction is allowed.
    return NextResponse.json(
      { error: "Set a password (or enable 2FA) before deleting your account." },
      { status: 400 }
    );
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
      prisma.userSession.deleteMany({ where: { userId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Failed to delete account:", e);
    return NextResponse.json({ error: "Failed to delete account. Please try again." }, { status: 500 });
  }
}
