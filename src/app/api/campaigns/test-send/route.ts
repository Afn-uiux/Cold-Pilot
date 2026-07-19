export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { decryptAccount } from "@/lib/crypto";
import { canSendFromAccount } from "@/lib/send-gate";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId, stepIndex, subject, bodyHtml, senderEmail, recipientEmail } = await req.json();
  if (!recipientEmail?.includes("@")) return NextResponse.json({ error: "Valid recipient email required" }, { status: 400 });
  if (!subject?.trim() && !bodyHtml?.trim()) return NextResponse.json({ error: "Cannot send a blank email — add a subject or body first" }, { status: 400 });

  const rawAccount = await prisma.emailAccount.findFirst({ where: { userId: session.user.id } });
  if (!rawAccount) return NextResponse.json({ error: "No email account connected" }, { status: 400 });
  const account = decryptAccount(rawAccount);

  // Shared send gate
  const gate = await canSendFromAccount(account.id, account.dailySendLimit || 50);
  if (!gate.allowed) {
    return NextResponse.json({ error: `Send blocked: ${gate.reason}` }, { status: 429 });
  }

  const fromEmail = senderEmail || account.email;

  try {
    if (account.gmailToken) {
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: account.gmailToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const headers = [
        `From: ${fromEmail} <${fromEmail}>`,
        `To: ${recipientEmail}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        `Subject: ${subject || "Test Email"}`,
      ];

      const raw = Buffer.from([...headers, "", bodyHtml || ""].join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
    } else if (account.smtpHost && account.smtpUser && account.smtpPass) {
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort || 587,
        secure: (account.smtpPort || 587) === 465,
        auth: { user: account.smtpUser, pass: account.smtpPass },
      });
      await transporter.sendMail({
        from: `"${fromEmail}" <${fromEmail}>`,
        to: recipientEmail,
        subject: subject || "Test Email",
        html: bodyHtml || "",
      });
    } else {
      return NextResponse.json({ error: "Email account has no sending method configured" }, { status: 400 });
    }

    const domain = fromEmail.split("@")[1] || "";
    const { checkDeliverability } = await import("@/lib/deliverability");
    const result = await checkDeliverability(domain, bodyHtml);

    return NextResponse.json({
      success: true,
      deliverabilityScore: result.overallScore,
      deliverability: result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send test email" }, { status: 500 });
  }
}
