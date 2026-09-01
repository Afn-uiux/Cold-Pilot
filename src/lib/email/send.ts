import { readFileSync } from "fs";
import { join } from "path";
import { getTemplateById, type EmailTemplateId } from "./templates";

interface SendEmailOptions {
  to: string;
  template: EmailTemplateId;
  data?: Record<string, any>;
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
  const { subject, html } = renderEmail(template, data);

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Coldpilot <hello@mail.usecoldpilot.com>",
      to,
      subject,
      html,
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
