import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seeds = await prisma.seedMailbox.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, email: true, provider: true, isActive: true,
      lastUsed: true, emailsReceivedTotal: true,
      repliesSentTotal: true, spamRescuesTotal: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(seeds);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    email, smtpHost, smtpPort, smtpUser, smtpPass,
    imapHost, imapPort, imapUser, imapPass, provider,
  } = body;

  if (!email || !smtpHost || !smtpUser || !smtpPass || !imapHost || !imapUser || !imapPass) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.seedMailbox.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "Seed email already exists" }, { status: 409 });
  }

  const seed = await prisma.seedMailbox.create({
    data: {
      userId: session.user.id,
      email: email.toLowerCase().trim(),
      smtpHost, smtpPort: smtpPort || 587,
      smtpUser, smtpPass,
      imapHost, imapPort: imapPort || 993,
      imapUser, imapPass,
      provider: provider || "other",
    },
    select: {
      id: true, email: true, provider: true, isActive: true, createdAt: true,
    },
  });

  return NextResponse.json(seed, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, isActive } = body;

  const seed = await prisma.seedMailbox.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!seed) {
    return NextResponse.json({ error: "Seed not found" }, { status: 404 });
  }

  const updated = await prisma.seedMailbox.update({
    where: { id },
    data: { isActive: isActive ?? seed.isActive },
    select: { id: true, email: true, isActive: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const seed = await prisma.seedMailbox.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!seed) {
    return NextResponse.json({ error: "Seed not found" }, { status: 404 });
  }

  await prisma.seedMailbox.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
