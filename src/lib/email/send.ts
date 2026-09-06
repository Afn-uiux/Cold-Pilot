import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getTemplateById, type EmailTemplateId } from "./templates";

interface SendEmailOptions {
  to: string;
  template: EmailTemplateId;
  data?: Record<string, any>;
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

export function renderEmail(templateId: EmailTemplateId, data?: Record<string, unknown>) {
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`Unknown email template: ${templateId}`);
  const filePath = join(process.cwd(), "src", "lib", "email", "templates-html", template.filename);
  let html = readFileSync(filePath, "utf-8");

  html = html.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = data?.[key];
    return value !== undefined && value !== null ? String(value) : "";
  });

  return {
    subject: template.subject,
    html,
  };
}

export async function sendTransactionalEmail({ to, template, data }: SendEmailOptions) {
  const { subject, html: htmlWithRemote } = renderEmail(template, data);
  const { html, images } = embedSiteImages(htmlWithRemote);

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Coldpilot <hello@mail.usecoldpilot.com>",
      to,
      subject,
      html,
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
    from: process.env.EMAIL_FROM || "Coldpilot <hello@mail.usecoldpilot.com>",
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
export function sendEmailSafe(to: string, template: EmailTemplateId, data?: Record<string, any>) {
  sendTransactionalEmail({ to, template, data }).catch((err) => {
    console.error(`[email] Failed to send ${template} to ${to}:`, err?.message || err);
  });
}
