export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { normalizeMessageId } from "@/engine/send";
import nodemailer from "nodemailer";
import { decryptAccount } from "@/lib/crypto";
import { canSendFromAccount } from "@/lib/send-gate";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, body } = await req.json();
  if (!leadId || !body?.trim()) return NextResponse.json({ error: "Missing leadId or body" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: session.user.id, deletedAt: null } });
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
  account = decryptAccount(account) as typeof account;

  // Shared send gate
  const gate = await canSendFromAccount(account.id, account.dailySendLimit || 50);
  if (!gate.allowed) {
    return NextResponse.json({ error: `Send blocked: ${gate.reason}` }, { status: 429 });
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

      const fromName = account.displayName || account.email;
      // Gmail's API response id is an internal identifier that never appears
      // in the delivered message, so In-Reply-To/References on later sends
      // (and Sent-folder mirroring) would never match it. Generate and set our
      // own RFC Message-ID so the stored id equals the one actually sent —
      // mirroring sendViaGmailApi in the campaign send path.
      const domain = account.email.split("@").pop() || "coldpilot.local";
      const generatedMessageId = normalizeMessageId(`${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}`);
      const headers = [
        `From: ${fromName} <${account.email}>`,
        `To: ${lead.email}`,
        "MIME-Version: 1.0",
        `Message-ID: ${generatedMessageId}`,
        "Content-Type: text/html; charset=utf-8",
        `Subject: ${subjectLine}`,
        `In-Reply-To: ${normalizeMessageId(lastLog?.messageId || "")}`,
        `References: ${normalizeMessageId(lastLog?.messageId || "")}`,
      ];

      const raw = Buffer.from([...headers, "", htmlBody].join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw, threadId: lastLog?.threadId || undefined },
      });
      messageId = generatedMessageId;
    } else if (account.smtpHost && account.smtpUser && account.smtpPass) {
      // SMTP fallback
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort || 587,
        secure: (account.smtpPort || 587) === 465,
        auth: { user: account.smtpUser, pass: account.smtpPass },
      });
      const fromName = account.displayName || account.email;
      const info = await transporter.sendMail({
        from: `"${fromName}" <${account.email}>`,
        to: lead.email,
        subject: subjectLine,
        html: htmlBody,
        inReplyTo: normalizeMessageId(lastLog?.messageId || ""),
        references: normalizeMessageId(lastLog?.messageId || ""),
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
    const msg = typeof err?.message === "string" ? err.message : "";
    if (msg.includes("invalid_grant") || msg.includes("invalid_token")) {
      return NextResponse.json({ error: "This email account is no longer connected. Reconnect it." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send reply. Please try again." }, { status: 500 });
  }
}