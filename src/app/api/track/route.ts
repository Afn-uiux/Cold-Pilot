export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchWebhookEvent } from "@/lib/webhook";

const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") || "open";
  const redirect = searchParams.get("redirect");
  const stepId = searchParams.get("stepId");

  if (id) {
    try {
      const whereBase: any = { leadId: id };
      if (stepId) whereBase.campaignStepId = stepId;

      if (type === "click") {
        const updated = await prisma.emailLog.updateMany({
          where: { ...whereBase, clickedAt: null },
          data: { clickedAt: new Date() },
        });
        console.log(`[track] click: leadId=${id} stepId=${stepId} updated=${updated.count}`);
        const lead = await prisma.lead.findUnique({ where: { id }, select: { email: true, userId: true } });
        if (lead) {
          dispatchWebhookEvent({ event: "click", userId: lead.userId, data: { leadId: id, email: lead.email } });
        }
      } else {
        const updated = await prisma.emailLog.updateMany({
          where: { ...whereBase, openedAt: null },
          data: { openedAt: new Date() },
        });
        console.log(`[track] open: leadId=${id} stepId=${stepId} updated=${updated.count}`);
        const lead = await prisma.lead.findUnique({ where: { id }, select: { email: true, userId: true } });
        if (lead) {
          dispatchWebhookEvent({ event: "open", userId: lead.userId, data: { leadId: id, email: lead.email } });
        }
      }
    } catch (err) {
      console.error("[track] error:", err);
    }
  }

  if (redirect) {
    return NextResponse.redirect(decodeURIComponent(redirect));
  }

  return new NextResponse(PIXEL_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
