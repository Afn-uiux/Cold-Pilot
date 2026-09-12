import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getTemplateById, type EmailTemplateId } from "./templates";

interface SendEmailOptions {
  to: string;
  template: EmailTemplateId;
  data?: Record<string, any>;
  /** Send from the founder address (yemi@me.usecoldpilot.com) using RESEND_FOUNDER_API_KEY. */
  fromFounder?: boolean;
}

interface EmbeddedImage {
  filename: string;
  path: string;
  content: Buffer;
  contentType: string;
  contentId: string;
}

const SITE_IMG_SRC_RE = /src="https:\/\/usecoldpilot\.com\/([^"]+)"/g;

// Rewrites <img src="https://usecoldpilot.com/<asset>"> to src="cid:<filename>"
// so the logo, illustrations, and social icons ship inside the email itself and
// render even with no internet connection. Returns the matching files to attach.
function embedSiteImages(html: string) {
  const images = new Map<string, EmbeddedImage>();

  const embeddedHtml = html.replace(SITE_IMG_SRC_RE, (full, relPath: string) => {
    const cleanRel = relPath.split("#")[0].split("?")[0];
    const localPath = join(process.cwd(), "public", cleanRel);
    if (!existsSync(localPath)) return full;

    const filename = cleanRel.split("/").pop() || cleanRel;
    let img = images.get(filename);
    if (!img) {
      img = {
        filename,
        path: localPath,
        content: readFileSync(localPath),
        contentType: "image/png",
        contentId: filename,
      };
      images.set(filename, img);
    }
    return `src="cid:${filename}"`;
  });

  return { html: embeddedHtml, images: [...images.values()] };
}

// All template {{variables}} are text/URLs — escape them so a user-controlled
// value (waitlist name, digest lead emails, campaign names) can never inject
// markup into a transactional email from the trusted sender (audit M-2).
function escapeHtml(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Rough HTML-to-text: strip tags, decode entities, collapse whitespace.
 *  Good enough for a plain-text fallback — not a full parser. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&nbsp;/g, " ")
    .replace(/&bull;/g, "\u2022")
    .replace(/&middot;/g, "\u00b7")
    .replace(/&copy;/g, "\u00a9")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderEmail(templateId: EmailTemplateId, data?: Record<string, unknown>) {
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`Unknown email template: ${templateId}`);
  const filePath = join(process.cwd(), "src", "lib", "email", "templates-html", template.filename);
  let html = readFileSync(filePath, "utf-8");

  html = html.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = data?.[key];
    return value !== undefined && value !== null ? escapeHtml(value) : "";
  });

  return {
    subject: template.subject,
    html,
  };
}

export async function sendTransactionalEmail({ to, template, data, fromFounder }: SendEmailOptions) {
  const { subject, html: htmlWithRemote } = renderEmail(template, data);
  const { html, images } = embedSiteImages(htmlWithRemote);

  const apiKey = fromFounder ? process.env.RESEND_FOUNDER_API_KEY : process.env.RESEND_API_KEY;
  const fromAddress =
    fromFounder && apiKey
      ? "Yemi from Coldpilot <yemi@me.usecoldpilot.com>"
      : "Coldpilot <hello@mail.usecoldpilot.com>";

  if (apiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      text: htmlToText(html),
      attachments: images.map((img) => ({
        filename: img.filename,
        content: img.content,
        contentType: img.contentType,
        contentId: img.contentId,
      })),
    });
    return;
  }

  const { default: nodemailer } = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || fromAddress,
    to,
    subject,
    html,
    attachments: images.map((img) => ({
      filename: img.filename,
      path: img.path,
      contentType: img.contentType,
      cid: img.contentId,
    })),
  });
}

/**
 * Fire-and-forget email sender. Never throws. Safe to call in try/catch
 * blocks where the main action should proceed regardless of email delivery.
 */
export function sendEmailSafe(to: string, template: EmailTemplateId, data?: Record<string, any>, opts?: { fromFounder?: boolean }) {
  sendTransactionalEmail({ to, template, data, fromFounder: opts?.fromFounder }).catch((err) => {
    console.error(`[email] Failed to send ${template} to ${to}:`, err?.message || err);
  });
}
