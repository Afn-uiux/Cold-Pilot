import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";

  // Redirect to a client page that handles the auth flow
  if (code) {
    return NextResponse.redirect(`${siteUrl}/auth/supabase-callback?code=${code}&next=${next}`);
  }

  return NextResponse.redirect(`${siteUrl}/auth/login`);
}
