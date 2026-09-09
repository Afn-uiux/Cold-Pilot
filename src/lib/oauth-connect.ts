import { ImapFlow } from "imapflow";
import { assertSafeMailTarget } from "@/lib/ssrf";

type DecryptedAccount = Record<string, any>;

// OAuth flows for reading warmup inboxes. Gmail/Owners connect via OAuth and
// only carry a refresh token — no imapUser/imapPass — so the warmup reader
// must mint a short-lived access token and connect with XOAUTH2 instead.

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
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

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenant = process.env.AZURE_AD_TENANT_ID || "common";
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
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

// Resolve the IMAP identity for an account: plain SMTP/IMAP creds when present,
// otherwise OAuth XOAUTH2 (Gmail or Microsoft refresh token -> access token).
// Returns null when the account can't be reached — callers should skip it.
export async function resolveImapAuth(account: DecryptedAccount): Promise<{
  host: string;
  port: number;
  auth: { user: string; pass: string } | { user: string; accessToken: string };
} | null> {
  if (!account.email) return null;

  if (account.provider === "Gmail" && account.gmailToken) {
    const accessToken = await refreshGoogleAccessToken(account.gmailToken);
    if (!accessToken) return null;
    return {
      host: account.imapHost || "imap.gmail.com",
      port: account.imapPort || 993,
      auth: { user: account.email, accessToken },
    };
  }

  if (account.microsoftToken || account.microsoftRefreshToken) {
    const accessToken = await refreshMicrosoftAccessToken(account.microsoftRefreshToken);
    if (!accessToken) return null;
    return {
      host: account.imapHost || "outlook.office365.com",
      port: account.imapPort || 993,
      auth: { user: account.email, accessToken },
    };
  }

  if (!account.imapHost || !account.imapUser || !account.imapPass) return null;
  return {
    host: account.imapHost,
    port: account.imapPort || 993,
    auth: { user: account.imapUser, pass: account.imapPass },
  };
}

// Open an IMAP connection to a mailbox using its stored creds or OAuth. SSRF-
// guarded like every other outbound socket in the app.
export async function openImap(account: DecryptedAccount): Promise<ImapFlow | null> {
  const resolved = await resolveImapAuth(account);
  if (!resolved) return null;
  try {
    await assertSafeMailTarget(resolved.host, resolved.port, "IMAP");
    const client = new ImapFlow({
      host: resolved.host,
      port: resolved.port,
      secure: true,
      auth: resolved.auth,
      logger: false,
    });
    await client.connect();
    return client;
  } catch {
    return null;
  }
}