import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { categorizeBounce } from "@/lib/bounce";

interface SendOptions {
  to: string;
  subject: string;
  htmlBody: string;
  fromName?: string;
  emailAccountId: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  leadId: string;
  campaignStepId?: string;
  trackingId?: string;
  openTracking?: boolean;
  clickTracking?: boolean;
}

function rewriteLinks(html: string, baseUrl: string, leadId: string, campaignStepId?: string): string {
  return html.replace(
    /<a\s([^>]*?)href\s*=\s*"(https?:\/\/[^"]+)"/gi,
    (match, attrs, url) => {
      if (url.includes(baseUrl.replace(/https?:\/\//, ""))) return match;
      const stepParam = campaignStepId ? `&stepId=${campaignStepId}` : "";
      const tracked = `${baseUrl}/api/track?id=${leadId}&type=click&redirect=${encodeURIComponent(url)}${stepParam}`;
      return `<a ${attrs}href="${tracked}"`;
    }
  );
}

export async function sendEmail(opts: SendOptions) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: opts.emailAccountId },
  });
  if (!account || account.status !== "active") {
    throw new Error("Email account not found or not active");
  }

  const suppressed = await prisma.suppression.findUnique({
    where: { userId_email: { userId: account.userId, email: opts.to.toLowerCase().trim() } },
  });
  if (suppressed) {
    throw new Error(`Email ${opts.to} is suppressed (${suppressed.reason})`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  // Open/click tracking work by having the recipient's mail client load a URL
  // from the public internet. A localhost URL is only reachable from this
  // machine, so tracking silently never fires. This can't be auto-fixed (it
  // needs a real deployed URL or a tunnel like ngrok), but it should at least
  // be loud in the logs instead of failing invisibly.
  if ((opts.openTracking || opts.clickTracking) && baseUrl.includes("localhost")) {
    console.warn(
      `[tracking] NEXT_PUBLIC_URL is set to "${baseUrl}" — open/click tracking links will be unreachable from recipients' inboxes. ` +
      `Set NEXT_PUBLIC_URL to a public URL (deployed domain or ngrok tunnel) for tracking to work.`
    );
  }

  let html = opts.htmlBody;
  // Convert plain-text newlines to HTML breaks for proper rendering in email clients
  if (html && !html.match(/<br|<p|<div|<li|<h[1-6]/i)) {
    html = html.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>");
    html = `<p>${html}</p>`;
  }
  if (opts.clickTracking === true) {
    html = rewriteLinks(html, baseUrl, opts.leadId, opts.campaignStepId);
  }

  const trackingPixel = (opts.trackingId && opts.openTracking === true)
    ? `<img src="${baseUrl}/api/track?id=${opts.trackingId}${opts.campaignStepId ? `&stepId=${opts.campaignStepId}` : ""}" width="1" height="1" alt="" style="display:none;" />`
    : "";

  const body = html + trackingPixel;
  const fromName = opts.fromName || account.displayName || account.email;

  let sendResult: { messageId: string; threadId: string };

  try {
    if (account.provider === "Gmail" && account.gmailToken) {
      sendResult = await sendViaGmailApi(account, opts.to, opts.subject, body, fromName, opts.threadId, opts.inReplyTo, opts.references);
    } else {
      const smtpId = await sendViaSmtp(account, opts.to, opts.subject, body, fromName, opts.inReplyTo, opts.references);
      sendResult = { messageId: smtpId, threadId: opts.threadId || smtpId };
    }
  } catch (err: any) {
    const bounce = categorizeBounce(err);
    await prisma.emailLog.create({
      data: {
        leadId: opts.leadId,
        campaignStepId: opts.campaignStepId,
        emailAccountId: opts.emailAccountId,
        type: "outgoing",
        status: "error",
        subject: opts.subject,
        bodyHtml: body,
        error: err.message || "Unknown error",
        bounceCategory: bounce.type,
      },
    });

    // Mark account as error on auth failures
    if (err.code === "EAUTH" || err.code === "EACCESS" || err.message?.includes("invalid_grant")) {
      await prisma.emailAccount.update({
        where: { id: opts.emailAccountId },
        data: { status: "error" },
      });
    }

    throw err;
  }

  // Log successful send
  await prisma.emailLog.create({
    data: {
      leadId: opts.leadId,
      campaignStepId: opts.campaignStepId,
      emailAccountId: opts.emailAccountId,
      type: "outgoing",
      status: "sent",
      subject: opts.subject,
      bodyHtml: body,
      messageId: sendResult.messageId,
      threadId: sendResult.threadId,
    },
  });

  return sendResult;
}

async function sendViaGmailApi(
  account: any, to: string, subject: string, htmlBody: string,
  fromName: string, threadId?: string | null, inReplyTo?: string | null, references?: string | null
): Promise<{ messageId: string; threadId: string }> {
  const { google } = await import("googleapis");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.gmailToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const headers = [
    `From: ${fromName} <${account.email}>`,
    `To: ${to}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    `Subject: ${subject}`,
  ];
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${references || inReplyTo}`);
  }

  const raw = Buffer.from([...headers, "", htmlBody].join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  });

  return { messageId: res.data.id!, threadId: res.data.threadId! };
}

async function sendViaSmtp(
  account: any, to: string, subject: string, htmlBody: string,
  fromName: string, inReplyTo?: string | null, references?: string | null
): Promise<string> {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost!,
    port: account.smtpPort!,
    secure: account.smtpPort === 465,
    auth: {
      user: account.smtpUser!,
      pass: account.smtpPass!,
    },
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${account.email}>`,
    to,
    subject,
    html: htmlBody,
    ...(inReplyTo ? { inReplyTo, references: references || inReplyTo } : {}),
  });

  return info.messageId;
}
