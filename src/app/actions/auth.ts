"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { TRIAL_MS } from "@/lib/trial";
import { signIn } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmailSafe } from "@/lib/email/send";
import { computeSignupRisk } from "@/lib/fraud";

export async function signup(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fingerprint = (formData.get("fingerprint") as string) || null;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const { headers } = await import("next/headers");
  const h = await headers();
  const rawIp = h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown";
  const ip = rawIp.split(",")[0].trim();

  const { allowed, retryAfterMs } = checkRateLimit(`signup:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `Too many signups from this network. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
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

  // Risk gate: never blocks, only flags for admin review. The pattern rule
  // (mailbox-reuse void + fresh sibling from the same device) lands here.
  const risk = await computeSignupRisk({ userId: user.id, email, fingerprint, ip });
  if (risk.score > 0 || risk.status === "flagged") {
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

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });

  return { success: true };
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { headers } = await import("next/headers");
  const h = await headers();
  const ip = h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown";
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
      redirect: false,
    });
    return { success: true };
  } catch {
    return { error: "Invalid email or password" };
  }
}

export async function resetPassword(email: string, newPassword: string) {
  if (!email || !newPassword) {
    return { error: "Email and new password are required" };
  }
  if (newPassword.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "No account found with this email" };
  }
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
  sendEmailSafe(email, "password-changed");
  return { success: true };
}

export async function demoLogin() {
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
