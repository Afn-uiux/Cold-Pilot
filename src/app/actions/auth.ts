"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { TRIAL_MS } from "@/lib/trial";
import { signIn } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logLoginAttempt } from "@/lib/login-audit";
import { computeSignupRisk, voidTrial } from "@/lib/fraud";
import { sendVerificationEmail } from "@/lib/verification";
import { currencyFromHeaders } from "@/lib/currency";

// Client-supplied device fingerprints must be structurally sane before we
// store or score them. Anything that isn't a bounded alphanumeric hash is
// ignored (treated as absent) so malformed/adversarial payloads can't poison
// the shared fraud signals (audit M-6).
const FINGERPRINT_RE = /^[a-zA-Z0-9_-]{16,128}$/;

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

  const cleanFingerprint =
    typeof fingerprint === "string" && fingerprint.trim() && FINGERPRINT_RE.test(fingerprint.trim())
      ? fingerprint.trim()
      : null;

  const { headers } = await import("next/headers");
  const h = await headers();
  const ip = getClientIp(h as unknown as { get(name: string): string | null });

  // Currency is decided once, at registration, from the visitor's country
  // (NG -> NGN, everywhere else -> USD) and stored on the account so billing
  // displays and checkout stay consistent regardless of where they log in from
  // later.
  const billingCurrency = currencyFromHeaders(h as unknown as Headers);

  const { allowed, retryAfterMs } = checkRateLimit(`signup:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `Too many signups from this network. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  // Per-IP-per-domain throttle: the IP cap alone still permits fast rotation
  // across many domains from one network — a hallmark of trial/credit farming.
  const signupDomain = email.trim().toLowerCase().split("@")[1] || "";
  if (signupDomain) {
    const domainLimit = checkRateLimit(`signup:${ip}:${signupDomain}`, { max: 3, windowMs: 60 * 60 * 1000 });
    if (!domainLimit.allowed) {
      return { error: "Too many signups from this network for that email domain. Try again later." };
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.emailVerified) {
      // Account already exists but never had its verification link clicked.
      // Fire a fresh verification email so the "check your inbox" state the
      // UI shows is backed by an actual send (a silent no-op here made the
      // user stare at an inbox that never received anything).
      await sendVerificationEmail(email);
      return { success: true, verificationRequired: true };
    }
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
      billingCurrency,
      deviceFingerprint: cleanFingerprint,
      signupIp: ip !== "unknown" ? ip : null,
    },
  });

  // Risk gate: blocks on a hard blocklist hit (a device/IP that was
  // previously banned via killUser), otherwise flags for admin review.
  const risk = await computeSignupRisk({ userId: user.id, email, fingerprint: cleanFingerprint, ip });
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
      deviceFingerprint: cleanFingerprint,
      ip: ip !== "unknown" ? ip : null,
    },
  });

  // No welcome email here — it goes out only once the user clicks the
  // verification link (see /api/auth/verify). The verification email is the
  // only thing sent at signup.
  await sendVerificationEmail(email);

  // No auto-login: login is hard-blocked until the email is verified, so the
  // signup page shows a "check your inbox to verify, then log in" state.
  return { success: true, verificationRequired: true };
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
  const ua = h.get("user-agent");
  const emailKey = email.trim().toLowerCase();
  const rateKey = `login:${ip}:${emailKey}`;

  const { allowed, retryAfterMs } = checkRateLimit(rateKey);
  if (!allowed) {
    await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: false, reason: "throttled" });
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `Too many attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  // Every failure returns the same message. In particular we deliberately do
  // NOT reveal whether an unverified account exists for this email — a
  // distinct "verify your email" response would let anyone probe which
  // addresses are registered here.
  try {
    const result = await signIn("credentials", {
      email,
      password,
      ...(code ? { code } : {}),
      redirect: false,
    });
    if (result?.error) {
      await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: false, reason: "invalid" });
      console.error("[LOGIN ERROR]", result.error);
      return { error: "Invalid email or password" };
    }
    await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: true, reason: "success" });
    return { success: true };
  } catch (e: any) {
    await logLoginAttempt({ email: emailKey, ip, userAgent: ua, success: false, reason: "error" });
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
  const email = "demo@usecoldpilot.com";
  const password = "demo123456";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        name: "Demo User",
        email,
        password: hashedPassword,
        emailVerified: new Date(),
      },
    });
  } else if (!existing.emailVerified) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { emailVerified: new Date() },
    });
  }

  await signIn("credentials", { email, password, redirect: false });
}
