import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({ where: { userId: session.user.id, deletedAt: null } });
  const account = await prisma.emailAccount.findFirst({ where: { userId: session.user.id } });
  if (!account) {
    return NextResponse.json({ error: "Connect an email account first" }, { status: 400 });
  }

  // Check if we already have a simulated lead, reuse it
  let lead = await prisma.lead.findFirst({ where: { email: "amberdenson85@gmail.com" } });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        firstName: "Amber",
        lastName: "Denson",
        email: "amberdenson85@gmail.com",
        company: "Brightside Media",
        status: "active",
        userId: session.user.id,
        campaignId: campaign?.id || null,
      },
    });
  }

  // Check if there's already a sent email for this lead
  let emailLog = await prisma.emailLog.findFirst({ where: { leadId: lead.id, type: "outgoing" } });
  if (!emailLog) {
    emailLog = await prisma.emailLog.create({
      data: {
        leadId: lead.id,
        emailAccountId: account.id,
        subject: "Quick question about your website",
        bodyHtml: "Hi Sarah,<br><br>Noticed Acme Corp's site — would you be open to a quick chat this week?<br><br>Best,<br>Bryan",
        type: "outgoing",
        status: "sent",
        threadId: "sandbox_" + Date.now(),
        messageId: "sandbox_msg_" + Date.now(),
        sentAt: new Date(Date.now() - 86400000),
      },
    });
  }

  // Mark as replied (skip real Gmail send)
  if (!emailLog.repliedAt) {
    await prisma.emailLog.update({ where: { id: emailLog.id }, data: { repliedAt: new Date() } });
  }
  await prisma.lead.update({ where: { id: lead.id }, data: { status: "replied" } });

  let pipeline = await prisma.pipeline.findFirst({ where: { userId: session.user.id } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: { userId: session.user.id, name: "Sales Pipeline", stages: JSON.stringify(["lead", "interested", "meeting_booked", "meeting_completed", "won", "no_show", "out_of_office", "wrong_person", "not_interested", "lost"]) },
    });
  }
  const existingDeal = await prisma.deal.findFirst({ where: { leadId: lead.id } });
  if (!existingDeal) {
    await prisma.deal.create({
      data: { userId: session.user.id, pipelineId: pipeline.id, leadId: lead.id, name: "Amber Denson — Brightside Media", value: 0, stage: "lead" },
    });
  }

  return NextResponse.json({ success: true, leadId: lead.id });
}
