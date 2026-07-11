import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function getMicrosoftTokenUrl(tenant: string) {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenant = process.env.AZURE_AD_TENANT_ID || "common";
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(getMicrosoftTokenUrl(tenant), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  let { smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass, encryption, emailAccountId } = body;

  let useOAuth = false;

  if (emailAccountId) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: emailAccountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }
    smtpHost = account.smtpHost;
    smtpPort = account.smtpPort;
    smtpUser = account.smtpUser;
    smtpPass = account.smtpPass;
    imapHost = account.imapHost;
    imapPort = account.imapPort;
    imapUser = account.imapUser;
    imapPass = account.imapPass;

    if (account.microsoftToken && account.microsoftRefreshToken) {
      const refreshed = await refreshMicrosoftToken(account.microsoftRefreshToken);
      if (refreshed) {
        useOAuth = true;
        smtpUser = account.email;
        smtpPass = refreshed.accessToken;
        imapUser = account.email;
        imapPass = refreshed.accessToken;
        await prisma.emailAccount.update({
          where: { id: account.id },
          data: { microsoftToken: refreshed.accessToken, microsoftRefreshToken: refreshed.refreshToken },
        });
      }
    }
  }

  const errors: string[] = [];

  if (smtpHost && smtpPort && smtpUser && smtpPass !== undefined) {
    const port = Number(smtpPort);
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: useOAuth
          ? { type: "OAuth2", user: smtpUser, accessToken: smtpPass }
          : { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });
      await transporter.verify();
    } catch (err: any) {
      let message = "SMTP connection failed";
      if (err.code === "EAUTH") message = "Invalid SMTP username or password.";
      else if (err.code === "ESOCKET") message = `Could not connect to ${smtpHost}:${port}.`;
      else if (err.code === "ETIMEDOUT") message = "SMTP connection timed out.";
      else if (err.message?.includes("SSL")) message = "SSL/TLS handshake failed. Try a different encryption.";
      else message = err.message || message;
      errors.push(message);
    }
  }

  if (imapHost && imapUser && imapPass !== undefined) {
    try {
      const client = new ImapFlow({
        host: imapHost,
        port: Number(imapPort) || 993,
        secure: true,
        auth: useOAuth ? { user: imapUser, accessToken: imapPass } : { user: imapUser, pass: imapPass },
        logger: false,
      });
      await client.connect();
      await client.logout();
    } catch (err: any) {
      let message = "IMAP connection failed";
      if (err.code === "AUTHENTICATIONFAILED") message = "Invalid IMAP username or password.";
      else if (err.returnCode === 1 || err.code === "ECONNREFUSED") message = `Could not connect to ${imapHost}:${imapPort || 993}.`;
      else message = err.message || message;
      errors.push(message);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors.join("; "), errors });
  }

  return NextResponse.json({ success: true });
}
