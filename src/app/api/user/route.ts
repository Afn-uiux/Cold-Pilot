export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCreditState } from "@/lib/credits";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, plan: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const credits = await getCreditState(session.user.id);

  return NextResponse.json({
    name: user.name,
    email: user.email,
    plan: user.plan,
    creditBalance: credits?.balance ?? 0,
    aiEnabled: credits?.aiEnabled ?? false,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email } = await req.json();
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ name: updated.name, email: updated.email });
}
