import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");

  if (!leadId) {
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

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "unsubscribed" },
  });

  await prisma.suppression.upsert({
    where: { userId_email: { userId: lead.userId, email: lead.email.toLowerCase().trim() } },
    create: { userId: lead.userId, email: lead.email.toLowerCase().trim(), reason: "unsubscribed", type: "unsubscribe" },
    update: { reason: "unsubscribed", type: "unsubscribe" },
  });

  return new NextResponse(
    `<html><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc">
      <div style="text-align:center;max-width:400px;padding:40px">
        <h1 style="font-size:24px;color:#0f1929;margin-bottom:8px">You've been unsubscribed</h1>
        <p style="color:#5a6b87;font-size:15px">You will no longer receive emails from this campaign.</p>
      </div>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
