export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

const GOOGLE_ISSUER = "https://accounts.google.com";

function patchIssForGoogle(req: Request): NextRequest {
  try {
    const url = new URL(req.url);
    const [segment, provider] = url.pathname.split("/").filter(Boolean).slice(-2);
    if (
      segment === "callback" &&
      provider === "google" &&
      !url.searchParams.has("iss")
    ) {
      url.searchParams.set("iss", GOOGLE_ISSUER);
      return new NextRequest(url, req);
    }
  } catch {
    // fall through to the original request on malformed URLs
  }
  return req as NextRequest;
}

export function GET(req: Request) {
  return handlers.GET(patchIssForGoogle(req));
}

export function POST(req: Request) {
  return handlers.POST(req as NextRequest);
}