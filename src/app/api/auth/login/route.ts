export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const code = (formData.get("code") as string) || undefined;

    if (!email || !password) {
      return NextResponse.redirect(new URL("/auth/login?error=missing", req.url));
    }

    const result = await signIn("credentials", {
      email,
      password,
      ...(code ? { code } : {}),
      redirect: false,
    });

    if (result?.error) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid", req.url));
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=failed", req.url));
  }
}
