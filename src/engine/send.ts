import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { categorizeBounce } from "@/lib/bounce";
import { decryptAccount } from "@/lib/crypto";
import { canSendFromAccount } from "@/lib/send-gate";
import { canSendToLead } from "@/lib/verify";
import { signRedirect, signUnsubscribe } from "@/lib/track-sign";
import { assertSafeSocketTarget, isAllowedSocketPort } from "@/lib/ssrf";

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
  // Mirrors campaign.enableRiskyEmails so the send-time backstop holds to the
  // same policy as the campaign planner (risky leads are allowed only when the
  // user opted in; invalid/unknown/catch-all policy lives in canSendToLead).
  enableRiskyEmails?: boolean;
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

// Strip CR/LF and control characters from a value destined for an email
// header. Without this, a subject/name/recipient containing a newline followed
// by "Bcc: ..." smuggles extra headers into the raw MIME we hand to the Gmail
// API (header injection). nodemailer validates its own headers, but the
// raw-MIME path does not, so every externally-influenced header value must pass
// through here. Implemented as a codepoint scan (rather than a control-char
// regex) so CR/LF/TAB fold to a single space while all other C0 controls and
// DEL are dropped, leaving multi-byte UTF-8 (names, subjects) intact.
function headerSafe(value: string): string {
  let out = "";
  for (const ch of String(value ?? "")) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0d || code === 0x0a || code === 0x09) {
      out += " "; // CR / LF / TAB -> space (fold, don't glue words together)
    } else if (code < 0x20 || code === 0x7f) {
      continue; // drop remaining C0 controls + DEL
    } else {
      out += ch;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}



function rewriteLinks(html: string, baseUrl: string, leadId: string, campaignStepId?: string): string {
  const stepParam = campaignStepId ? `&stepId=${campaignStepId}` : "";
  const wrap = (url: string): string => {
    if (url.includes(baseUrl.replace(/https?:\/\//, ""))) return url;
    const ts = Date.now();
    const sig = signRedirect(leadId, campaignStepId, url, ts);
    return `${baseUrl}/api/track?id=${leadId}&type=click&redirect=${encodeURIComponent(url)}${stepParam}&ts=${ts}&sig=${sig}`;
  };

  // Extract every <a ...>...</a> element. Explicit links are fully rewritten
  // (and stored as a placeholder) so their href AND inner text are protected
  // from the later bare-URL pass. Already-tracked/self links are kept as-is.
  const anchors = new Map<number, string>();
  let out = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (full, off) => {
    const hrefMatch = full.match(/href\s*=\s*"(https?:\/\/[^"]+)"/i);
    if (!hrefMatch) return full;
    if (hrefMatch[1].includes(baseUrl.replace(/https?:\/\//, ""))) return full;
    const tracked = full.replace(
      /(href\s*=\s*")https?:\/\/[^"]+"/i,
      (m, p) => `${p}${wrap(hrefMatch[1])}"`
    );
    const key = anchors.size;
    anchors.set(key, tracked);
    return `\u0000A${key}\u0000`;
  });

  // Wrap any remaining bare URLs in the plain text between tags. Tokenize all
  // remaining markup so nothing inside an attribute is matched.
  const tags: string[] = [];
  out = out.replace(/<[^>]*>/g, (tag) => {
    tags.push(tag);
    return `\u0000${tags.length - 1}\u0000`;
  });

  out = out.replace(/\u0000[Aa]?\d+\u0000|https?:\/\/[^\s<"')]+|(?<![A-Za-z0-9.@-])(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|me|dev|ai|app)(?:\/[^\s<"')]*)?/gi, (token) => {
    if (/^\u0000[Aa]?\d+\u0000$/.test(token)) return token;
    const href = /^https?:\/\//i.test(token) ? token : `https://${token}`;
    return `<a href="${wrap(href)}" style="color:#2563eb;text-decoration:underline;">${token}</a>`;
  });

  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => tags[Number(i)] ?? "");
  out = out.replace(/\u0000A(\d+)\u0000/g, (_, i) => anchors.get(Number(i)) ?? "");

  return out;
}

export async function sendEmail(opts: SendOptions) {
  const rawAccount = await prisma.emailAccount.findUnique({
    where: { id: opts.emailAccountId },
  });
  if (!rawAccount || rawAccount.status !== "active") {
    throw new Error("Email account not found or not active");
  }
  const account = decryptAccount(rawAccount);

  // Shared send gate — respects both campaign and warmup sends
  const gate = await canSendFromAccount(opts.emailAccountId, account.dailySendLimit || 50);
  if (!gate.allowed) {
    throw new Error(`Send blocked: ${gate.reason}`);
  }

  const lead = await prisma.lead.findUnique({
    where: { id: opts.leadId },
    select: { userId: true, verificationStatus: true },
  });
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Cross-tenant guard: the sending account and the target lead must belong
  // to the same tenant. Without this, any authenticated caller could send
  // through another user's email account and mutate their lead's logs.
  if (account.userId !== lead.userId) {
    throw new Error("Email account does not belong to this lead's owner");
  }

  const suppressed = await prisma.suppression.findUnique({
    where: { userId_email: { userId: account.userId, email: opts.to.toLowerCase().trim() } },
  });
  if (suppressed) {
    throw new Error(`Email ${opts.to} is suppressed (${suppressed.reason})`);
  }

  // Send-time verification backstop. Single source of truth is canSendToLead:
  // only a definitive hard "invalid" is ever blocked outright, and risky is
  // gated by the user's enableRiskyEmails opt-in (unknown/catch-all soft
  // flags are allowed through this guard, matching the campaign planner).
  const sendCheck = canSendToLead(lead?.verificationStatus ?? null, opts.enableRiskyEmails ?? false, false);
  if (!sendCheck.allowed) {
    throw new Error(`Email ${opts.to} blocked: verification status "${lead?.verificationStatus ?? "unverified"}" (${sendCheck.reason})`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const unsubscribeTs = Date.now();
  const unsubscribeUrl = opts.unsubscribeHeader ? `${baseUrl}/api/unsubscribe?lead=${opts.leadId}&ts=${unsubscribeTs}&sig=${signUnsubscribe(opts.leadId, unsubscribeTs)}` : null;

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
  // Match warmup's plain-text format: campaign bodies that are just simple
  // paragraph content (spintax, variables, line breaks — no real formatting)
  // render as clean plain text so they read like a normal email in Gmail.
  // HTML is only used when the body genuinely contains formatting (bold,
  // links, lists, headings, images) and plainTextOnly isn't set.
  const hasRichMarkup = /<(?:a|strong|b|em|i|u|ul|ol|li|h[1-6]|img|span)\b/i.test(opts.htmlBody || "");
  const isPlainText = opts.plainTextOnly || !hasRichMarkup;

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

  const body = isPlainText ? html : html + trackingPixel;
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

  // Every externally-influenced header value below is run through headerSafe()
  // before it enters the raw MIME string. The Gmail API takes a caller-assembled
  // RFC822 message (unlike nodemailer, which validates its own headers), so an
  // un-sanitized CR/LF in fromName/to/subject/threading headers would inject
  // arbitrary extra headers (e.g. Bcc) or a fake body. See headerSafe() above.
  const headers = [
    `From: ${headerSafe(fromName)} <${headerSafe(account.email)}>`,
    `To: ${headerSafe(to)}`,
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
  headers.push(`Subject: ${headerSafe(subject)}`);
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${headerSafe(normalizeMessageId(inReplyTo))}`);
    const refChain = (references || inReplyTo).split(/\s+/).filter(Boolean).map(normalizeMessageId).join(" ");
    headers.push(`References: ${headerSafe(refChain)}`);
  }
  if (listUnsubscribe) {
    headers.push(`List-Unsubscribe: <${headerSafe(listUnsubscribe)}>`);
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

  // Gmail rewrites the Message-ID header at delivery to its own
  // CAJ...@mail.gmail.com; the header we set in raw above is discarded. The
  // receiver's client threads by the ID it actually saw, so we must store the
  // delivered Message-ID — otherwise follow-ups' In-Reply-To references an ID
  // the receiver never received and threading breaks on the receiver side.
  let deliveredMessageId = generatedMessageId;
  try {
    const sent = await gmail.users.messages.get({
      userId: "me",
      id: res.data.id!,
      format: "metadata",
      metadataHeaders: ["Message-ID"],
    });
    const mid = sent.data.payload?.headers?.find(h => h.name?.toLowerCase() === "message-id")?.value;
    if (mid) deliveredMessageId = normalizeMessageId(mid);
  } catch (err: any) {
    console.warn(`[send] Could not read delivered Message-ID for ${res.data.id}:`, err?.message);
  }

  return { messageId: deliveredMessageId, threadId: res.data.threadId! };
}

async function sendViaSmtp(
  account: any, to: string, subject: string, htmlBody: string,
  fromName: string, inReplyTo?: string | null, references?: string | null,
  listUnsubscribe?: string | null, isPlainText?: boolean
): Promise<string> {
  // SSRF guard: the SMTP host/port come from user-configured account settings,
  // so a hostile account could point them at an internal service (169.254.x,
  // 127.0.0.1, a metadata endpoint) and use this authenticated send as a
  // blind port-probe / connect primitive. Restrict to known mail ports and
  // reject any host that resolves into a private/reserved range. (Residual
  // TOCTOU: nodemailer re-resolves at connect — see assertSafeSocketTarget.)
  const smtpPort = Number(account.smtpPort);
  if (!isAllowedSocketPort(smtpPort)) {
    throw new Error(`SMTP port ${account.smtpPort} is not allowed`);
  }
  const targetErr = await assertSafeSocketTarget(account.smtpHost!, smtpPort);
  if (targetErr) {
    throw new Error(`SMTP host not allowed: ${targetErr}`);
  }

  const transporter = nodemailer.createTransport({
    host: account.smtpHost!,
    port: smtpPort,
    secure: smtpPort === 465,
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
