"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function signup(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: hashedPassword,
    },
  });

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
