export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { NextResponse } from "next/server";
import { sendEmail } from "@/engine/send";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { to, subject, htmlBody, fromName, emailAccountId, leadId, campaignStepId, threadId, inReplyTo } = await req.json();

  if (!to || !subject || !htmlBody || !emailAccountId || !leadId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await sendEmail({
      to, subject, htmlBody, fromName, emailAccountId, leadId, campaignStepId, threadId, inReplyTo,
      trackingId: leadId,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}