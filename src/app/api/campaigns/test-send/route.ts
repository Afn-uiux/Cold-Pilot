export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
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

  const { campaignId, stepIndex, subject, bodyHtml, senderEmail, recipientEmail } = await req.json();
  if (!recipientEmail?.includes("@")) return NextResponse.json({ error: "Valid recipient email required" }, { status: 400 });
  if (!subject?.trim() && !bodyHtml?.trim()) return NextResponse.json({ error: "Cannot send a blank email — add a subject or body first" }, { status: 400 });

  const rawAccounts = await prisma.emailAccount.findMany({ where: { userId: session.user.id, deletedAt: null } });
  if (!rawAccounts.length) return NextResponse.json({ error: "No email account connected" }, { status: 400 });
  const rawAccount = rawAccounts[0];
  const account = decryptAccount(rawAccount);

  // Anti-relay: the sender must be one of the user's own connected addresses,
  // so test-send cannot be abused to spoof an arbitrary From.
  const requestedFrom = senderEmail || account.email;
  const isOwnAddress = rawAccounts.some((a: any) => { try { return (decryptAccount(a)).email === requestedFrom; } catch { return false; } });
  if (!isOwnAddress) {
    return NextResponse.json({ error: "Sender email must be one of your connected addresses" }, { status: 400 });
  }
  const fromEmail = requestedFrom;

  // Anti-relay: the recipient must be the user themself or a lead they own —
  // never an arbitrary third-party address (which would turn test-send into a
  // free relay/spam tool).
  const target = String(recipientEmail).toLowerCase().trim();
  const ownedLead = await prisma.lead.findFirst({ where: { userId: session.user.id, email: target, deletedAt: null }, select: { id: true, email: true } });
  const ownedAddress = isOwnAddress && requestedFrom.toLowerCase() === target ? true : undefined;
  if (!ownedLead && !ownedAddress) {
    return NextResponse.json({ error: "Recipient must be a lead in your account or your own email" }, { status: 400 });
  }

  // Shared send gate
  const gate = await canSendFromAccount(account.id, account.dailySendLimit || 50);
  if (!gate.allowed) {
    return NextResponse.json({ error: `Send blocked: ${gate.reason}` }, { status: 429 });
  }

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
    console.error("Test send failed:", err);
    const msg = typeof err?.message === "string" ? err.message : "";
    if (msg.includes("invalid_grant") || msg.includes("invalid_token")) {
      return NextResponse.json({ error: "This email account is no longer connected. Reconnect it." }, { status: 401 });
    }
    if (msg.includes("EAUTH") || msg.includes("EACCESS")) {
      return NextResponse.json({ error: "SMTP login failed. Check your password." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to send test email. Please try again." }, { status: 500 });
  }
}