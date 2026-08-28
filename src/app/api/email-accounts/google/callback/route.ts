export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptAccount } from "@/lib/crypto";
import { recordMailboxConnect } from "@/lib/fraud";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return htmlPage({ success: false, error: "Not authenticated. Please log in first." });
    }

    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      return htmlPage({ success: false, error: "Google login was cancelled or denied." });
    }

    const code = req.nextUrl.searchParams.get("code");
    const returnedState = req.nextUrl.searchParams.get("state");
    const cookieState = req.cookies.get("google_oauth_state")?.value;

    if (!code || !returnedState || returnedState !== cookieState) {
      return htmlPage({ success: false, error: "Invalid state parameter. Please try again." });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/email-accounts/google/callback`;

    if (!clientId || !clientSecret) {
      return htmlPage({ success: false, error: "Google OAuth not configured." });
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
      return htmlPage({ success: false, error: "Failed to exchange auth code for token." });
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      return htmlPage({ success: false, error: "No access token received." });
    }
    if (!refreshToken) {
      return htmlPage({ success: false, error: "Google did not return a refresh token. Please try again and grant access." });
    }

    // Get user email from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return htmlPage({ success: false, error: "Failed to get user info from Google." });
    }

    const userInfo = await userInfoRes.json();
    const email = userInfo.email;
    const displayName = userInfo.name || "";
    // Immutable Google sub id — stable across reconnects and renames.
    const providerAccountId = String(userInfo.id || email);

    if (!email) {
      return htmlPage({ success: false, error: "Could not retrieve email from Google account." });
    }

    // Save or update the email account
    const existing = await prisma.emailAccount.findFirst({
      where: { userId: session.user.id, email },
    });

    if (existing) {
      await prisma.emailAccount.update({
        where: { id: existing.id },
        data: encryptAccount({
          gmailToken: refreshToken,
          status: "active",
        }),
      });
    } else {
      await prisma.emailAccount.create({
        data: encryptAccount({
          userId: session.user.id,
          email,
          displayName,
          provider: "Gmail",
          smtpHost: "smtp.gmail.com",
          smtpPort: 587,
          imapHost: "imap.gmail.com",
          imapPort: 993,
          dailySendLimit: 50,
          warmupEnabled: true,
          warmupFilterTag: (function () {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            let tag = "";
            for (let i = 0; i < 6; i++) tag += chars[Math.floor(Math.random() * chars.length)];
            return tag;
          })(),
          gmailToken: refreshToken,
        }),
      });
    }

    // Permanent mailbox fingerprinting (keyed on the immutable Google sub id).
    await recordMailboxConnect({
      userId: session.user.id,
      provider: "google-oauth",
      providerAccountId,
      email,
    });

    return htmlPage({ success: true });
  } catch (err: any) {
    console.error("Google account connection failed:", err);
    return htmlPage({ success: false, error: "Failed to connect your Google account. Please try again." });
  }
}

function htmlPage(result: { success: boolean; error?: string }) {
  const payload = JSON.stringify({ source: "google", ...result });
  const html = `<!DOCTYPE html>
<html>
<head><title>Google Account Connection</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, "*");
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
