import { prisma } from "./prisma";

// Records a login attempt for admin visibility (see /admin/login-attempts).
// Never throws and never blocks the login itself — a storage failure must not
// break authentication.
export async function logLoginAttempt(input: {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  reason: string;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: (input.email || "").trim().toLowerCase().slice(0, 320),
        ip: input.ip && input.ip !== "unknown" ? input.ip.slice(0, 64) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 300) : null,
        success: input.success,
        reason: input.reason,
      },
    });
  } catch {
    // Logging is best-effort.
  }
}