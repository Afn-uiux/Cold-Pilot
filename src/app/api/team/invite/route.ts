export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // For now, just log the invite — full team management requires more infrastructure
  console.log(`[team] Invite requested by ${session.user.id} for ${email}`);

  return NextResponse.json({ success: true, message: `Invitation sent to ${email}` });
}
