export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCreditState } from "@/lib/credits";
import { getTrialStatus } from "@/lib/trial";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, plan: true, trialEndsAt: true, trialVoided: true, billingCurrency: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const credits = await getCreditState(session.user.id);
  const trial = getTrialStatus(user.plan, user.trialEndsAt, user.trialVoided);

  return NextResponse.json({
    name: user.name,
    email: user.email,
    plan: user.plan,
    billingCurrency: user.billingCurrency,
    creditBalance: credits?.balance ?? 0,
    aiEnabled: credits?.aiEnabled ?? false,
    trial,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, billingCurrency } = await req.json();

  // Changing the account email is a high-sensitivity action: it can be used to
  // hijack another address or repoint the login identifier. Require the user's
  // current password as proof of account control. Passwordless (OAuth-only)
  // accounts must set a password before they can change their email.
  if (email !== undefined && typeof email === "string" && email.trim()) {
    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });
    if (!account?.password) {
      return NextResponse.json(
        { error: "Set a password first, then verify it to change your email." },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || !(await bcrypt.compare(password, account.password))) {
      return NextResponse.json({ error: "Current password is required to change your email" }, { status: 403 });
    }
  }

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined && typeof email === "string" && email.trim()) data.email = email.trim();
  if (billingCurrency === "NGN" || billingCurrency === "USD") data.billingCurrency = billingCurrency;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  // Mirror the currency override into the client cookie so prices re-render in
  // the chosen currency immediately (same cookie name the proxy stamps).
  const res = NextResponse.json({
    name: updated.name,
    email: updated.email,
    billingCurrency: updated.billingCurrency,
  });
  if (billingCurrency === "NGN" || billingCurrency === "USD") {
    res.cookies.set("cc", billingCurrency, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, httpOnly: false });
  }
  return res;
}
