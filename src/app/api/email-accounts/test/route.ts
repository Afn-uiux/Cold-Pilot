export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { trialGuard } from "@/lib/trial";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decryptAccount, encryptAccount } from "@/lib/crypto";
import { assertSafeSocketTarget, isAllowedSocketPort } from "@/lib/ssrf";
import { rateLimitAsync } from "@/lib/rate-limit";

async function getGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
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
    return data.access_token || null;
  } catch {
    return null;
  }
}

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
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttle: each call opens live SMTP/IMAP connections to third-party
  // servers with caller-supplied credentials — a probe/credential-stuffing
  // amplifier without a per-user limit.
  const rl = await rateLimitAsync(`conntest:${session.user.id}`, { max: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many connection tests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await req.json();
  let { smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass, encryption, emailAccountId } = body;

  let useOAuth = false;

  if (emailAccountId) {
    const rawAccount = await prisma.emailAccount.findFirst({
      where: { id: emailAccountId, userId: session.user.id },
    });
    if (!rawAccount) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }
    const account = decryptAccount(rawAccount);
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
          data: encryptAccount({ microsoftToken: refreshed.accessToken, microsoftRefreshToken: refreshed.refreshToken }),
        });
      }
    } else if (account.provider === "Gmail" && account.gmailToken) {
      const accessToken = await getGoogleAccessToken(account.gmailToken);
      if (accessToken) {
        useOAuth = true;
        smtpUser = account.email;
        smtpPass = accessToken;
        imapUser = account.email;
        imapPass = accessToken;
        if (!smtpHost) smtpHost = "smtp.gmail.com";
        if (!smtpPort) smtpPort = 587;
        if (!imapHost) imapHost = "imap.gmail.com";
        if (!imapPort) imapPort = 993;
      }
    }
  }

  const errors: string[] = [];

  if (smtpHost && smtpPort && smtpUser && smtpPass !== undefined) {
    const port = Number(smtpPort);
    const hostErr = await assertSafeSocketTarget(smtpHost, port);
    if (hostErr) {
      errors.push(`SMTP: ${hostErr}`);
    } else if (!isAllowedSocketPort(port)) {
      errors.push(`SMTP: port ${port} not allowed`);
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure: port === 465,
          auth: useOAuth
            ? { type: "OAuth2", user: smtpUser, accessToken: smtpPass }
            : { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: true },
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
  }

  if (imapHost && imapUser && imapPass !== undefined) {
    const imapPortNum = Number(imapPort) || 993;
    const hostErr = await assertSafeSocketTarget(imapHost, imapPortNum);
    if (hostErr) {
      errors.push(`IMAP: ${hostErr}`);
    } else if (!isAllowedSocketPort(imapPortNum)) {
      errors.push(`IMAP: port ${imapPortNum} not allowed`);
    } else {
      try {
        const client = new ImapFlow({
          host: imapHost,
          port: imapPortNum,
          secure: true,
          auth: useOAuth ? { user: imapUser, accessToken: imapPass } : { user: imapUser, pass: imapPass },
          logger: false,
        });
        await client.connect();
        await client.logout();
      } catch (err: any) {
        let message = "IMAP connection failed";
        if (err.code === "AUTHENTICATIONFAILED") message = "Invalid IMAP username or password.";
        else if (err.returnCode === 1 || err.code === "ECONNREFUSED") message = `Could not connect to ${imapHost}:${imapPortNum}.`;
        else message = err.message || message;
        errors.push(message);
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors.join("; "), errors });
  }

  return NextResponse.json({ success: true });
}