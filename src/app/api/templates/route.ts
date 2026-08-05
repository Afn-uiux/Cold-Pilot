export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.template.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, subject, bodyHtml } = await req.json();
  if (!name || !subject) {
    return NextResponse.json({ error: "Name and subject are required" }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: { name, subject, bodyHtml: bodyHtml || "", userId: session.user.id },
  });

  return NextResponse.json(template);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  const template = await prisma.template.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ success: true });
}