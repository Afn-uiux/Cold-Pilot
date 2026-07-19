export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptAccount } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return htmlPage({ success: false, error: "Not authenticated. Please log in first." });
    }

    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      return htmlPage({ success: false, error: "Microsoft login was cancelled or denied." });
    }

    const code = req.nextUrl.searchParams.get("code");
    const returnedState = req.nextUrl.searchParams.get("state");
    const cookieState = req.cookies.get("microsoft_oauth_state")?.value;

    if (!code || !returnedState || returnedState !== cookieState) {
      return htmlPage({ success: false, error: "Invalid state parameter. Please try again." });
    }

    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const tenant = process.env.AZURE_AD_TENANT_ID || "common";
    const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/email-accounts/microsoft/callback`;

    if (!clientId || !clientSecret) {
      return htmlPage({ success: false, error: "Microsoft OAuth not configured." });
    }

    // Exchange code for tokens
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return htmlPage({ success: false, error: "Failed to exchange auth code for token." });
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      return htmlPage({ success: false, error: "No access token received." });
    }

    // Get user email from Microsoft Graph
    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!graphRes.ok) {
      return htmlPage({ success: false, error: "Failed to get user info from Microsoft." });
    }

    const graphData = await graphRes.json();
    const email = graphData.mail || graphData.userPrincipalName;
    const displayName = graphData.displayName || "";

    if (!email) {
      return htmlPage({ success: false, error: "Could not retrieve email from Microsoft account." });
    }

    // Save or update the email account
    const existing = await prisma.emailAccount.findFirst({
      where: { userId: session.user.id, email },
    });

    if (existing) {
      await prisma.emailAccount.update({
        where: { id: existing.id },
        data: encryptAccount({
          microsoftToken: accessToken,
          microsoftRefreshToken: refreshToken,
        }),
      });
    } else {
      await prisma.emailAccount.create({
        data: encryptAccount({
          userId: session.user.id,
          email,
          displayName,
          provider: "Outlook",
          smtpHost: "smtp.office365.com",
          smtpPort: 587,
          imapHost: "outlook.office365.com",
          imapPort: 993,
          dailySendLimit: 50,
          microsoftToken: accessToken,
          microsoftRefreshToken: refreshToken,
        }),
      });
    }

    // Also create SeedMailbox
    const smtpPass = accessToken;
    const existingSeed = await prisma.seedMailbox.findUnique({ where: { email } });
    if (!existingSeed) {
      await prisma.seedMailbox.create({
        data: encryptAccount({
          userId: session.user.id,
          email,
          smtpHost: "smtp.office365.com",
          smtpPort: 587,
          smtpUser: email,
          smtpPass,
          imapHost: "outlook.office365.com",
          imapPort: 993,
          imapUser: email,
          imapPass: accessToken,
          provider: "Outlook",
        }),
      });
    }

    return htmlPage({ success: true });
  } catch (err: any) {
    return htmlPage({ success: false, error: err.message || "An unexpected error occurred." });
  }
}

function htmlPage(result: { success: boolean; error?: string }) {
  const html = `<!DOCTYPE html>
<html>
<head><title>Microsoft Account Connection</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${JSON.stringify(result)}, "*");
  }
  window.close();
</script>
<p>${result.success ? "Account connected! You can close this window." : "Error: " + (result.error || "Unknown error")}</p>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
