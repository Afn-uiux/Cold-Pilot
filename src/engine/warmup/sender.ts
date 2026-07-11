import nodemailer from "nodemailer";

interface SendResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

function randomDelay(min = 5, max = 30): Promise<void> {
  const ms = (Math.random() * (max - min) + min) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendWarmupEmail(
  fromEmail: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPass: string,
  fromName: string | undefined,
  toEmail: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  await randomDelay(5, 30);

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: toEmail,
      subject,
      text: body,
    });

    return { success: true, messageId: info.messageId, error: null };
  } catch (err: any) {
    return { success: false, messageId: null, error: err.message || "Unknown SMTP error" };
  }
}
