import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
