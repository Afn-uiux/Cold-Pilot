export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Team management is not yet implemented — return 501 so callers know
  // the invitation was NOT sent rather than silently pretending it was.
  console.log(`[team] Invite requested by ${session.user.id} for ${email}`);

  return NextResponse.json({ success: false, message: "Team invites are not yet implemented." }, { status: 501 });
}