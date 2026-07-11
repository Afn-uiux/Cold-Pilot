import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AZURE_AD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Microsoft OAuth not configured (AZURE_AD_CLIENT_ID missing)" }, { status: 500 });
  }

  const tenant = process.env.AZURE_AD_TENANT_ID || "common";
  const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/email-accounts/microsoft/callback`;
  const state = crypto.randomUUID();

  const scope = [
    "openid",
    "email",
    "profile",
    "offline_access",
    "https://outlook.office.com/SMTP.Send",
    "https://outlook.office.com/IMAP.AccessAsUser.All",
  ].join(" ");

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope,
    state,
    response_mode: "query",
  })}`;

  const response = NextResponse.redirect(url);
  response.cookies.set("microsoft_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
