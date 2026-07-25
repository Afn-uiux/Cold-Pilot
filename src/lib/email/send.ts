import { emailTemplates, type EmailTemplateId } from "./templates";

interface SendEmailOptions {
  to: string;
  template: EmailTemplateId;
  data?: Record<string, any>;
}

export function renderEmail(templateId: EmailTemplateId, data: Record<string, any> = {}) {
  const template = emailTemplates[templateId];
  if (!template) throw new Error(`Unknown email template: ${templateId}`);
  return {
    subject: template.subject,
    html: template.html(data),
  };
}

export async function sendTransactionalEmail({ to, template, data = {} }: SendEmailOptions) {
  const { subject, html } = renderEmail(template, data);

  // Use the existing email sending infrastructure
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
    from: process.env.EMAIL_FROM || "Coldpilot <notifications@coldpilot.io>",
    to,
    subject,
    html,
  });
}
