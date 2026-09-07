import { NextResponse } from "next/server";

// Bounces the checkout return URL back onto the real app origin after a
// payment (or cancellation). Checkout POSTs the tunnel/public URL to satisfy
// Bachs' "publicly reachable" requirement; this endpoint redirects the browser
// to NEXT_PUBLIC_URL (localhost in dev, the live domain in production) where
// the session cookie actually applies.
const APP_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const billing = to === "cancelled" ? "cancelled" : "success";
  return NextResponse.redirect(
    `${APP_URL}/dashboard/settings?tab=Billing&billing=${billing}`
  );
}