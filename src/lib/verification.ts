// How long a one-click email-verification link stays valid. The token is
// consumed on first click (deleted in the verify route), so this only bounds
// the window in which a stale/leaked link works. 24h is the practical sweet
// spot: forgiving for users who return later, but never persistently valid.
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

import crypto from "crypto";
import { prisma } from "./prisma";
import { hashToken } from "./tokens";
import { sendEmailSafe } from "./email/send";

// Fires the one-click email-verification link. Signup credits are gated on
// email verification, so this must run at signup (both credential and Google)
// rather than waiting for the user to discover the verify endpoint.
// Fire-and-forget; silent on failure.
export async function sendVerificationEmail(email: string): Promise<void> {
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
    // Only the SHA-256 digest of the token is stored (lib/tokens) so a DB
    // leak can never be used to verify an arbitrary email the attacker
    // didn't actually control the inbox for.
    await prisma.verificationToken.create({
      data: { identifier: email, token: hashToken(token), expires },
    });
    const verifyUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/auth/verify?token=${token}`;
    await sendEmailSafe(email, "email-verification", { verifyUrl });
  } catch (err) {
    console.error("[verification] Failed to send verification email:", err);
  }
}