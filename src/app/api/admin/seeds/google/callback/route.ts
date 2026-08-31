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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "admin") {
      return htmlPage({ success: false, error: "Admin access required." });
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
    const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/admin/seeds/google/callback`;

    if (!clientId || !clientSecret) {
      return htmlPage({ success: false, error: "Google OAuth not configured." });
    }

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

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return htmlPage({ success: false, error: "Failed to get user info from Google." });
    }

    const userInfo = await userInfoRes.json();
    const email = userInfo.email;
    const displayName = userInfo.name || "";

    if (!email) {
      return htmlPage({ success: false, error: "Could not retrieve email from Google account." });
    }

    const existing = await prisma.seedInbox.findUnique({ where: { email } });

    if (existing) {
      await prisma.seedInbox.update({
        where: { id: existing.id },
        data: encryptAccount({
          gmailToken: refreshToken,
          status: "active",
        }),
      });
    } else {
      await prisma.seedInbox.create({
        data: encryptAccount({
          email,
          displayName,
          provider: "gmail",
          smtpHost: "smtp.gmail.com",
          smtpPort: 587,
          imapHost: "imap.gmail.com",
          imapPort: 993,
          gmailToken: refreshToken,
          status: "active",
          warmupStartedAt: new Date(),
        }),
      });
    }

    return htmlPage({ success: true });
  } catch (err: any) {
    console.error("Seed Google connection failed:", err);
    return htmlPage({ success: false, error: "Failed to connect seed. Please try again." });
  }
}

function htmlPage(result: { success: boolean; error?: string }) {
  const payload = JSON.stringify({ source: "seed-google", ...result });
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const html = `<!DOCTYPE html>
<html>
<head><title>Seed Connect</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, ${JSON.stringify(origin)});
  }
  window.close();
</script>
<p>${result.success ? "Seed connected! You can close this window." : "Error: " + (result.error || "Unknown error")}</p>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
