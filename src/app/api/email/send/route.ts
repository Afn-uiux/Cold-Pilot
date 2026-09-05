export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/engine/send";
import { spendCredits, InsufficientCreditsError } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/plans";
import { rateLimitAsync } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttle: each call sends a real email and spends a credit.
  const rl = await rateLimitAsync(`send:${session.user.id}`, { max: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many send requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const { to, subject, htmlBody, fromName, emailAccountId, leadId, campaignStepId, threadId, inReplyTo } = await req.json();

  if (!to || !subject || !htmlBody || !emailAccountId || !leadId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // BOLA/IDOR hardening: the caller may only send through their own account
  // and to their own lead. The engine guard (account.userId === lead.userId)
  // alone does NOT tie either resource to the authenticated caller.
  const [account, lead, user] = await Promise.all([
    prisma.emailAccount.findFirst({ where: { id: emailAccountId, userId: session.user.id } }),
    prisma.lead.findFirst({ where: { id: leadId, userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
  ]);
  if (!account) return NextResponse.json({ error: "Email account not found" }, { status: 404 });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Metered-billing guard: free/pay-as-you-go manual sends must spend a credit,
  // matching the campaign engine. The refId makes this idempotent across retries.
  if (user?.plan === "free") {
    try {
      await spendCredits(session.user.id, CREDIT_COSTS.campaign, "campaign_send", `manual_send:${leadId}`);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: "You're out of credits. Buy more to send emails." },
          { status: 402 },
        );
      }
      console.error("Manual send credit deduction failed:", err);
      return NextResponse.json({ error: "Failed to process credits. Please try again." }, { status: 500 });
    }
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