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
    console.error("Email send failed:", err);
    const msg = typeof err?.message === "string" ? err.message : "";
    if (msg.includes("is suppressed")) return NextResponse.json({ error: msg }, { status: 400 });
    if (msg.includes("blocked: verification status")) return NextResponse.json({ error: msg }, { status: 400 });
    if (msg.includes("invalid_grant") || msg.includes("invalid_token")) {
      return NextResponse.json({ error: "This email account is no longer connected. Reconnect it." }, { status: 401 });
    }
    if (msg.includes("EAUTH") || msg.includes("EACCESS")) {
      return NextResponse.json({ error: "SMTP login failed. Check your password." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }
}