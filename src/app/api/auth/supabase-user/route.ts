export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { email, name, avatar } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const tempPassword = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    user = await prisma.user.create({
      data: { email, name, password: hashedPassword, image: avatar },
    });
    return NextResponse.json({ id: user.id, email: user.email, password: tempPassword });
  }

  // User exists — we need a password to log them in with NextAuth
  if (!user.password) {
    const tempPassword = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    return NextResponse.json({ id: user.id, email: user.email, password: tempPassword });
  }

  return NextResponse.json({ id: user.id, email: user.email });
}
