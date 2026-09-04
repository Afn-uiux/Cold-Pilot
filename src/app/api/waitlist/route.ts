export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmailSafe } from "@/lib/email/send";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  // Small per-IP throttle so the public form can't be used to stuff the table.
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`waitlist:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many signups from this address. Try again later." },
      { status: 429 }
    );
  }

  let email = "";
  let name = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").toLowerCase().trim();
    name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Idempotent: re-submits of the same email are a success, not an error.
  const existing = await prisma.waitlistEntry.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.waitlistEntry.create({ data: { name, email, source: "waitlist" } });

  // Notify the operator of genuinely new signups (never throws — the signup
  // itself already succeeded). Set WAITLIST_NOTIFY_TO to your own email to
  // receive these; when unset, signups are DB-only.
  const notifyTo = process.env.WAITLIST_NOTIFY_TO;
  if (notifyTo) {
    const count = await prisma.waitlistEntry.count().catch(() => 0);
    sendEmailSafe(notifyTo, "waitlist-notify", { name, email, count });
  }

  return NextResponse.json({ ok: true });
}
