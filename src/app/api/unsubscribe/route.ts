export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { dispatchWebhookEvent } from "@/lib/webhook";
import { dispatchIntegrationEvent } from "@/integrations";
import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/track-sign";

// POST performs the unsubscribe (one-click per List-Unsubscribe-Post). GET only
// renders a confirmation page — it must NOT unsubscribe, because email
// link-scanners and client prefetchers fetch every link in a message on GET,
// which would silently opt leads out without their intent.

export async function POST(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!leadId || !sig || !verifyUnsubscribe(leadId, sig)) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }

  const outcome = await performUnsubscribe(leadId);
  return NextResponse.json(outcome);
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!leadId || !sig || !verifyUnsubscribe(leadId, sig)) {
    return new NextResponse("<html><body><h1>Invalid unsubscribe link</h1></body></html>", {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return new NextResponse("<html><body><h1>Lead not found</h1></body></html>", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new NextResponse(
    `<html><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc">
      <div style="text-align:center;max-width:400px;padding:40px">
        <h1 style="font-size:24px;color:#0f1929;margin-bottom:8px">Unsubscribe from emails?</h1>
        <p style="color:#5a6b87;font-size:15px;margin-bottom:24px">You will no longer receive emails from this campaign.</p>
        <form method="post" action="/api/unsubscribe?lead=${encodeURIComponent(leadId)}&sig=${encodeURIComponent(sig)}">
          <button type="submit" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:15px;cursor:pointer">Confirm unsubscribe</button>
        </form>
      </div>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html", "Referrer-Policy": "no-referrer" } }
  );
}

async function performUnsubscribe(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return { success: false, error: "Lead not found" };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "unsubscribed" },
  });

  await prisma.suppression.upsert({
    where: { userId_email: { userId: lead.userId, email: lead.email.toLowerCase().trim() } },
    create: { userId: lead.userId, email: lead.email.toLowerCase().trim(), reason: "unsubscribed", type: "unsubscribe" },
    update: { reason: "unsubscribed", type: "unsubscribe" },
  });

  createNotification({
    userId: lead.userId,
    type: "unsubscribe",
    title: "Lead unsubscribed",
    message: `${lead.email} opted out`,
  }).catch(() => {});
  dispatchWebhookEvent({ event: "unsubscribe", userId: lead.userId, data: { leadId: lead.id, email: lead.email, reason: "unsubscribed" } }).catch(() => {});
  dispatchIntegrationEvent(lead.userId, "unsubscribe", { leadId: lead.id, email: lead.email }).catch(() => {});

  return { success: true };
}

