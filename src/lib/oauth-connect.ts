import { ImapFlow } from "imapflow";
import { assertSafeMailTarget } from "@/lib/ssrf";
import { createImapClient } from "@/lib/imap-client";

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

// Infer a provider from the account email domain. Used when the stored
// `provider` field is null/"other" or the account only carries SMTP creds.
function providerFromEmail(email: string): string {
  const domain = (email.split("@")[1] || "").toLowerCase();
  if (domain.includes("gmail") || domain.includes("googlemail")) return "gmail";
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return "outlook";
  if (domain.includes("yahoo")) return "yahoo";
  if (domain.includes("proton")) return "proton";
  return "other";
}

// Provider default IMAP endpoints. App-password / SMTP-only accounts don't
// store IMAP fields, but the same app password authenticates IMAP for the
// major providers, so we derive the endpoint from the provider.
function imapDefaultsFor(provider: string): { host: string; port: number } | null {
  switch (provider.toLowerCase()) {
    case "gmail":
      return { host: "imap.gmail.com", port: 993 };
    case "outlook":
    case "microsoft":
    case "exchange":
      return { host: "outlook.office365.com", port: 993 };
    case "yahoo":
      return { host: "imap.mail.yahoo.com", port: 993 };
    case "proton":
      return null; // Proton requires the Bridge — no plain IMAP.
    default:
      return null;
  }
}

// Resolve the IMAP identity for an account. Handles every way a mailbox can
// be attached:
//   1. Plain IMAP creds (host/user/pass present)  -> direct login
//   2. Gmail OAuth (gmailToken)                   -> XOAUTH2 access token
//   3. Microsoft OAuth (microsoft token)          -> XOAUTH2 access token
//   4. App-password / SMTP-only accounts          -> same creds to provider IMAP
// Returns null when the account can't be reached — callers should skip it.
export async function resolveImapAuth(account: DecryptedAccount): Promise<{
  host: string;
  port: number;
  auth: { user: string; pass: string } | { user: string; accessToken: string };
} | null> {
  if (!account.email) return null;

  const provider = (account.provider || providerFromEmail(account.email)).toLowerCase();
  const isGmail = provider === "gmail" || providerFromEmail(account.email) === "gmail";
  const isMicrosoft =
    provider === "outlook" || provider === "microsoft" || provider === "exchange";

  if (isGmail && account.gmailToken) {
    const accessToken = await refreshGoogleAccessToken(account.gmailToken);
    if (!accessToken) return null;
    return {
      host: account.imapHost || "imap.gmail.com",
      port: account.imapPort || 993,
      auth: { user: account.email, accessToken },
    };
  }

  if ((account.microsoftToken || account.microsoftRefreshToken) && isMicrosoft) {
    const accessToken = await refreshMicrosoftAccessToken(account.microsoftRefreshToken);
    if (!accessToken) return null;
    return {
      host: account.imapHost || "outlook.office365.com",
      port: account.imapPort || 993,
      auth: { user: account.email, accessToken },
    };
  }

  // Explicit IMAP creds always win.
  if (account.imapHost && account.imapUser && account.imapPass) {
    return {
      host: account.imapHost,
      port: account.imapPort || 993,
      auth: { user: account.imapUser, pass: account.imapPass },
    };
  }

  // App-password / SMTP-only accounts: reuse the SMTP identity against the
  // provider's IMAP endpoint. App passwords work across SMTP + IMAP.
  if (account.smtpUser && account.smtpPass) {
    const defaults = imapDefaultsFor(provider);
    if (!defaults) return null;
    return {
      host: defaults.host,
      port: defaults.port,
      auth: { user: account.smtpUser, pass: account.smtpPass },
    };
  }

  return null;
}

// Open an IMAP connection to a mailbox using its stored creds or OAuth. SSRF-
// guarded like every other outbound socket in the app.
export async function openImap(account: DecryptedAccount): Promise<ImapFlow | null> {
  const resolved = await resolveImapAuth(account);
  if (!resolved) return null;
  try {
    await assertSafeMailTarget(resolved.host, resolved.port, "IMAP");
    const client = createImapClient({
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