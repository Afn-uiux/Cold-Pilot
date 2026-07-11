import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhooks = await prisma.webhook.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(webhooks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, events } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  const secret = crypto.randomBytes(16).toString("hex");

  const webhook = await prisma.webhook.create({
    data: {
      userId: session.user.id,
      url,
      events: events || '["open","click","reply","bounce"]',
      secret,
    },
  });

  return NextResponse.json(webhook);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, url, events, active } = await req.json();
  const wh = await prisma.webhook.findFirst({ where: { id, userId: session.user.id } });
  if (!wh) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.webhook.update({
    where: { id },
    data: { ...(url !== undefined ? { url } : {}), ...(events !== undefined ? { events } : {}), ...(active !== undefined ? { active } : {}) },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const wh = await prisma.webhook.findFirst({ where: { id, userId: session.user.id } });
  if (!wh) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.webhook.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
