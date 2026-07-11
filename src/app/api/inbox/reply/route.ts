import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, body } = await req.json();
  if (!leadId || !body?.trim()) return NextResponse.json({ error: "Missing leadId or body" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: session.user.id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Find an account to reply from — prefer the one used for the last email, then any connected account
  const lastLog = await prisma.emailLog.findFirst({
    where: { leadId, type: "outgoing" },
    orderBy: { sentAt: "desc" },
    include: { emailAccount: true },
  });
  let account = lastLog?.emailAccount ?? null;
  if (!account) {
    account = await prisma.emailAccount.findFirst({ where: { userId: session.user.id } });
  }
  if (!account) {
    return NextResponse.json({ error: "No email account connected. Add one in Settings." }, { status: 400 });
  }

  const htmlBody = body.replace(/\n/g, "<br>");
  const subjectLine = `Re: ${lastLog?.subject || ""}`;
  let messageId: string;

  try {
    if (account.gmailToken) {
      // Gmail API
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: account.gmailToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const headers = [
        `From: ${account.email} <${account.email}>`,
        `To: ${lead.email}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        `Subject: ${subjectLine}`,
        `In-Reply-To: ${lastLog?.messageId || ""}`,
        `References: ${lastLog?.messageId || ""}`,
      ];

      const raw = Buffer.from([...headers, "", htmlBody].join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw, threadId: lastLog?.threadId || undefined },
      });
      messageId = res.data.id!;
    } else if (account.smtpHost && account.smtpUser && account.smtpPass) {
      // SMTP fallback
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort || 587,
        secure: (account.smtpPort || 587) === 465,
        auth: { user: account.smtpUser, pass: account.smtpPass },
      });
      const info = await transporter.sendMail({
        from: `"${account.email}" <${account.email}>`,
        to: lead.email,
        subject: subjectLine,
        html: htmlBody,
        inReplyTo: lastLog?.messageId || undefined,
        references: lastLog?.messageId || undefined,
        ...(lastLog?.threadId ? { threadId: lastLog.threadId } : {}),
      });
      messageId = info.messageId;
    } else {
      return NextResponse.json({ error: "Email account has no sending method configured (Gmail OAuth or SMTP)." }, { status: 400 });
    }

    await prisma.emailLog.create({
      data: {
        emailAccountId: account.id,
        leadId,
        subject: subjectLine,
        bodyHtml: htmlBody,
        type: "outgoing",
        status: "sent",
        messageId,
        threadId: lastLog?.threadId,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, messageId });
  } catch (err: any) {
    console.error("Reply send failed:", err);
    return NextResponse.json({ error: err.message || "Failed to send reply" }, { status: 500 });
  }
}
