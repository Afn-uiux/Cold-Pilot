"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { TRIAL_MS } from "@/lib/trial";
import { signIn } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmailSafe } from "@/lib/email/send";
import { computeSignupRisk, voidTrial } from "@/lib/fraud";
import crypto from "crypto";

export async function signup(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fingerprint = (formData.get("fingerprint") as string) || null;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 12) {
    return { error: "Password must be at least 12 characters" };
  }

  const { headers } = await import("next/headers");
  const h = await headers();
  const ip = getClientIp(h as unknown as { get(name: string): string | null });

  const { allowed, retryAfterMs } = checkRateLimit(`signup:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `Too many signups from this network. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Enumeration-safe: respond identically to a successful signup so an
    // attacker cannot probe which emails are registered. No account is created
    // and nothing is revealed; the legitimate owner just signs in normally.
    return { success: true };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: hashedPassword,
      trialEndsAt: new Date(Date.now() + TRIAL_MS),
      deviceFingerprint: fingerprint,
      signupIp: ip !== "unknown" ? ip : null,
    },
  });

  // Risk gate: blocks on a hard blocklist hit (a device/IP that was
  // previously banned via killUser), otherwise flags for admin review.
  const risk = await computeSignupRisk({ userId: user.id, email, fingerprint, ip });
  if (risk.flags.includes("blocked_device") || risk.flags.includes("blocked_ip")) {
    await voidTrial(user.id, "blocklist_hit");
    await prisma.user.update({
      where: { id: user.id },
      data: { riskStatus: "banned", riskScore: risk.score, riskFlags: JSON.stringify(risk.flags) },
    });
  } else if (risk.score > 0 || risk.status === "flagged") {
    await prisma.user.update({
      where: { id: user.id },
      data: { riskScore: risk.score, riskFlags: JSON.stringify(risk.flags), riskStatus: risk.status },
    });
  }
  await prisma.signupSignal.create({
    data: {
      userId: user.id,
      deviceFingerprint: fingerprint,
      ip: ip !== "unknown" ? ip : null,
    },
  });

  sendEmailSafe(email, "welcome");
  await sendVerificationEmail(email);

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });

  return { success: true };
}

// Fires the one-click email-verification link. Signup credits are gated on
// email verification, so this must run at signup rather than waiting for the
// user to discover the verify endpoint. Fire-and-forget; silent on failure.
async function sendVerificationEmail(email: string): Promise<void> {
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });
    const verifyUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/auth/verify?token=${token}`;
    await sendEmailSafe(email, "email-verification", { verifyUrl });
  } catch (err) {
    console.error("[signup] Failed to send verification email:", err);
  }
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const code = (formData.get("code") as string) || undefined;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { headers } = await import("next/headers");
  const h = await headers();
  const ip = getClientIp(h as unknown as { get(name: string): string | null });
  const rateKey = `login:${ip}:${email}`;

  const { allowed, retryAfterMs } = checkRateLimit(rateKey);
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `Too many attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      ...(code ? { code } : {}),
      redirect: false,
    });
    return { success: true };
  } catch (e: any) {
    console.error("[LOGIN ERROR]", e?.name, e?.message, e?.code);
    return { error: "Invalid email or password" };
  }
}

// NOTE: password resets now go through a token-based flow — see
// /api/auth/reset-password/request and /api/auth/reset-password/confirm.
// (Previously this action reset a password given only an email address with
// no proof of ownership, which let anyone take over any account. Don't
// reintroduce a variant that skips the emailed token.)

export async function demoLogin() {
  if (process.env.NODE_ENV === "production") {
    return { error: "Demo login is disabled in production" };
  }
  const email = "demo@coldpilot.io";
  const password = "demo123456";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        name: "Demo User",
        email,
        password: hashedPassword,
      },
    });
  }

  await signIn("credentials", { email, password, redirect: false });
}
