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
    const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/admin/seeds/microsoft/callback`;

    if (!clientId || !clientSecret) {
      return htmlPage({ success: false, error: "Microsoft OAuth not configured." });
    }

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
      return htmlPage({ success: false, error: "Failed to exchange auth code for token." });
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      return htmlPage({ success: false, error: "No access token received." });
    }

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

    const existing = await prisma.seedInbox.findUnique({ where: { email } });

    if (existing) {
      await prisma.seedInbox.update({
        where: { id: existing.id },
        data: encryptAccount({
          microsoftToken: accessToken,
          microsoftRefreshToken: refreshToken,
          status: "active",
        }),
      });
    } else {
      await prisma.seedInbox.create({
        data: encryptAccount({
          email,
          displayName,
          provider: "outlook",
          smtpHost: "smtp.office365.com",
          smtpPort: 587,
          imapHost: "outlook.office365.com",
          imapPort: 993,
          microsoftToken: accessToken,
          microsoftRefreshToken: refreshToken,
          status: "active",
          warmupStartedAt: new Date(),
        }),
      });
    }

    return htmlPage({ success: true });
  } catch (err: any) {
    console.error("Seed Microsoft connection failed:", err);
    return htmlPage({ success: false, error: "Failed to connect seed. Please try again." });
  }
}

function htmlPage(result: { success: boolean; error?: string }) {
  const payload = JSON.stringify({ source: "seed-microsoft", ...result });
  const html = `<!DOCTYPE html>
<html>
<head><title>Seed Connect</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, "*");
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
