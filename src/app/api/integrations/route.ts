import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integrations = await prisma.integration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(integrations.map(i => ({ id: i.id, provider: i.provider, label: i.label, active: i.active, createdAt: i.createdAt })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, config, label } = await req.json();
  if (!provider || !config) return NextResponse.json({ error: "Provider and config required" }, { status: 400 });

  const integration = await prisma.integration.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: { userId: session.user.id, provider, config: JSON.stringify(config), label: label || provider },
    update: { config: JSON.stringify(config), active: true, label: label || provider },
  });

  return NextResponse.json(integration);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const integration = await prisma.integration.findFirst({ where: { id, userId: session.user.id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.integration.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
