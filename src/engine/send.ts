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
  unsubscribeHeader?: boolean;
  plainTextOnly?: boolean;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapInEmailDocument(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    ${html}
  </div>
</body>
</html>`;
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
  const unsubscribeUrl = opts.unsubscribeHeader ? `${baseUrl}/api/unsubscribe?lead=${opts.leadId}` : null;

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
  const isPlainText = opts.plainTextOnly;

  if (isPlainText) {
    html = stripHtml(html);
  } else {
    // Always convert bare newlines to HTML breaks. Email clients treat
    // literal \n as whitespace, so without this, line breaks disappear.
    // If the body has no HTML tags at all, wrap in <p> for basic structure.
    const hasBlockTags = html.match(/<p[\s>]|<div[\s>]|<li[\s>]|<h[1-6][\s>]/i);
    if (hasBlockTags) {
      // Content already has block-level structure — just convert any
      // remaining bare newlines (between tags or inside inline tags) to <br>.
      html = html.replace(/([^>])\n/g, "$1<br>");
    } else {
      html = html.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>");
      html = `<p>${html}</p>`;
    }
    if (opts.clickTracking === true) {
      html = rewriteLinks(html, baseUrl, opts.leadId, opts.campaignStepId);
    }
  }

  const trackingPixel = (!isPlainText && opts.trackingId && opts.openTracking === true)
    ? `<img src="${baseUrl}/api/track?id=${opts.trackingId}${opts.campaignStepId ? `&stepId=${opts.campaignStepId}` : ""}" width="1" height="1" alt="" style="display:none;" />`
    : "";

  const body = isPlainText ? html : wrapInEmailDocument(html + trackingPixel);
  const fromName = opts.fromName || account.displayName || account.email;

  let sendResult: { messageId: string; threadId: string };

  try {
    if (account.provider === "Gmail" && account.gmailToken) {
      sendResult = await sendViaGmailApi(account, opts.to, opts.subject, body, fromName, opts.threadId, opts.inReplyTo, opts.references, unsubscribeUrl, isPlainText);
    } else {
      const smtpId = await sendViaSmtp(account, opts.to, opts.subject, body, fromName, opts.inReplyTo, opts.references, unsubscribeUrl, isPlainText);
      // For SMTP, store the nodemailer messageId as threadId only for the first email.
      // Follow-ups already have a valid threadId from the first email's log.
      sendResult = { messageId: normalizeMessageId(smtpId), threadId: opts.threadId || smtpId };
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

export function normalizeMessageId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed : `<${trimmed.replace(/^<|>$/g, "")}>`;
}

async function sendViaGmailApi(
  account: any, to: string, subject: string, htmlBody: string,
  fromName: string, threadId?: string | null, inReplyTo?: string | null, references?: string | null,
  listUnsubscribe?: string | null, isPlainText?: boolean
): Promise<{ messageId: string; threadId: string }> {
  const { google } = await import("googleapis");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.gmailToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // res.data.id (used further down) is Gmail's internal API message ID —
  // a completely different identifier from the RFC822 Message-ID header,
  // in a different format entirely. Storing that as our "messageId" meant
  // nothing we stored ever matched the real Message-ID header actually
  // sent, so In-Reply-To/References on every follow-up pointed at an ID
  // that never existed in any real email — breaking threading every time.
  // Generate and set our own Message-ID explicitly so the two are
  // guaranteed to match.
  const domain = account.email.split("@").pop() || "coldpilot.local";
  const generatedMessageId = normalizeMessageId(`${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}`);

  const headers = [
    `From: ${fromName} <${account.email}>`,
    `To: ${to}`,
    "MIME-Version: 1.0",
    `Message-ID: ${generatedMessageId}`,
  ];

  let contentType: string;
  let rawBody: string;

  if (isPlainText) {
    contentType = "text/plain; charset=utf-8";
    rawBody = htmlBody;
  } else {
    // Send multipart/alternative with both HTML and plain-text parts
    // so every email client renders the message properly.
    const textPart = stripHtml(htmlBody);
    const boundary = `Boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    contentType = `multipart/alternative; boundary="${boundary}"`;
    rawBody = [
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      "",
      textPart,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      "",
      htmlBody,
      `--${boundary}--`,
    ].join("\r\n");
  }

  headers.push(`Content-Type: ${contentType}`);
  headers.push(`Subject: ${subject}`);
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${normalizeMessageId(inReplyTo)}`);
    const refChain = (references || inReplyTo).split(/\s+/).filter(Boolean).map(normalizeMessageId).join(" ");
    headers.push(`References: ${refChain}`);
  }
  if (listUnsubscribe) {
    headers.push(`List-Unsubscribe: <${listUnsubscribe}>`);
    headers.push(`List-Unsubscribe-Post: List-Unsubscribe=One-Click`);
  }

  const raw = Buffer.from([...headers, "", rawBody].join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  console.log(`[send] Gmail API: to=${to} subject="${subject.slice(0, 60)}" threadId=${threadId || "new"} inReplyTo=${inReplyTo || "none"}`);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  });

  return { messageId: generatedMessageId, threadId: res.data.threadId! };
}

async function sendViaSmtp(
  account: any, to: string, subject: string, htmlBody: string,
  fromName: string, inReplyTo?: string | null, references?: string | null,
  listUnsubscribe?: string | null, isPlainText?: boolean
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
    ...(isPlainText ? { text: htmlBody } : { html: htmlBody, text: stripHtml(htmlBody) }),
    ...(inReplyTo ? {
      inReplyTo: normalizeMessageId(inReplyTo),
      references: (references || inReplyTo).split(/\s+/).filter(Boolean).map(normalizeMessageId).join(" "),
    } : {}),
    ...(listUnsubscribe ? { headers: { "List-Unsubscribe": `<${listUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
  });

  console.log(`[send] SMTP sent to ${to} inReplyTo=${inReplyTo || "none"} references=${(references || "").slice(0, 100) || "none"} messageId=${info.messageId}`);
  return info.messageId;
}
