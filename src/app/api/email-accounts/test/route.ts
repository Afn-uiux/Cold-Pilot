export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { trialGuard } from "@/lib/trial";
import nodemailer from "nodemailer";
import { createImapClient } from "@/lib/imap-client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decryptAccount, encryptAccount } from "@/lib/crypto";
import { assertSafeSocketTarget, isAllowedSocketPort } from "@/lib/ssrf";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Hosts a user may "test new credentials" against without first owning a
// configured email account. Anything custom must be tested through an
// account the user has already created (emailAccountId). This stops the
// endpoint from being used as a free arbitrary-host credential-stuffing /
// SMTP-enumeration oracle (the audit finding H-2).
const KNOWN_TEST_HOSTS = new Set([
  "smtp.gmail.com", "imap.gmail.com",
  "smtp.office365.com", "outlook.office365.com",
  "smtp.mail.yahoo.com", "imap.mail.yahoo.com",
  "smtp.zoho.com", "imap.zoho.com",
  "mail.gmx.com", "imap.gmx.com",
]);

// Provider-pair rule: SMTP and IMAP for a "free" (no account id) test must
// belong to the same provider, otherwise the pairwise probing turns into a
// cross-provider mailbox validator.
function sameProviderPair(smtp: string | undefined, imap: string | undefined): boolean {
  if (!smtp || !imap) return true;
  const s = smtp.toLowerCase();
  const i = imap.toLowerCase();
  if (s.includes("gmail") || i.includes("gmail")) return s.includes("gmail") && i.includes("gmail");
  if (s.includes("office365") || s.includes("outlook") || i.includes("office365") || i.includes("outlook")) {
    return (s.includes("office365") || s.includes("outlook")) && (i.includes("office365") || i.includes("outlook"));
  }
  if (s.includes("yahoo") || i.includes("yahoo")) return s.includes("yahoo") && i.includes("yahoo");
  return true;
}

const GENERIC_FAILURE = "Connection test failed. Double-check your server details and credentials, then try again.";

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
  // amplifier without a per-user AND per-IP limit.
  const [rlUser, rlIp] = await Promise.all([
    rateLimitAsync(`conntest:${session.user.id}`, { max: 20, windowMs: 60_000 }),
    rateLimitAsync(`conntest:ip:${getClientIp(req.headers as unknown as { get(name: string): string | null })}`, { max: 60, windowMs: 60_000 }),
  ]);
  if (!rlUser.ok || !rlIp.ok) {
    return NextResponse.json(
      { error: "Too many connection tests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await req.json();
  let { smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass, emailAccountId } = body;

  let useOAuth = false;

  // An account id means the user is (re)testing one of their OWN connected
  // mailboxes — the OAuth-refresh / stored-settings flow is unchanged.
  if (emailAccountId) {
    const rawAccount = await prisma.emailAccount.findFirst({
      where: { id: emailAccountId, userId: session.user.id },
    });
    if (!rawAccount) {
      // Uniform failure: never reveal whether the account exists.
      return NextResponse.json({ success: false, error: GENERIC_FAILURE }, { status: 200 });
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
  } else {
    // No account id: testing NEW credentials before saving them. To keep this
    // from becoming an arbitrary-host authentication oracle, only well-known
    // provider hosts are accepted here, the SMTP/IMAP pair must belong to the
    // same provider, and any violation gets the same generic failure.
    const smtp = String(smtpHost || "").toLowerCase();
    const imap = String(imapHost || "").toLowerCase();
    if ((smtp && !KNOWN_TEST_HOSTS.has(smtp)) || (imap && !KNOWN_TEST_HOSTS.has(imap)) || !sameProviderPair(smtp, imap)) {
      return NextResponse.json({ success: false, error: GENERIC_FAILURE }, { status: 200 });
    }
  }

  // Deliberately opaque: track failures locally for logging but NEVER return
  // granular reasons to the caller. Distinguishing "bad password" from
  // "server absent" / "lockout" is exactly what makes this a credential-
  // validation oracle for attackers.
  const anyFailure = await (async (): Promise<boolean> => {
    if (smtpHost && smtpPort && smtpUser && smtpPass !== undefined) {
      const port = Number(smtpPort);
      const hostErr = await assertSafeSocketTarget(String(smtpHost), port).catch(() => "unsafe");
      if (!hostErr && isAllowedSocketPort(port)) {
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
        } catch {
          return true;
        }
      } else {
        return true;
      }
    }

    if (imapHost && imapUser && imapPass !== undefined) {
      const imapPortNum = Number(imapPort) || 993;
      const hostErr = await assertSafeSocketTarget(String(imapHost), imapPortNum).catch(() => "unsafe");
      if (!hostErr && isAllowedSocketPort(imapPortNum)) {
        try {
          const client = createImapClient({
            host: imapHost,
            port: imapPortNum,
            secure: true,
            auth: useOAuth ? { user: imapUser, accessToken: imapPass } : { user: imapUser, pass: imapPass },
            logger: false,
          });
          await client.connect();
          await client.logout();
        } catch {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  })();

  if (anyFailure) {
    return NextResponse.json({ success: false, error: GENERIC_FAILURE }, { status: 200 });
  }

  return NextResponse.json({ success: true });
}