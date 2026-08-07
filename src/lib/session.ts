import { prisma } from "./prisma";

// Must match the NextAuth JWT session maxAge (see src/lib/auth.ts).
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Called from the jwt callback on real sign-in (never on token refresh).
// Creates the authoritative row a session must have to remain valid.
export async function createSession(userId: string, sid: string): Promise<void> {
  await prisma.userSession.create({
    data: {
      userId,
      sid,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
}

// Called on sign-out (both the NextAuth events.signOut hook and the custom
// /api/auth/signout route). Deleting the row means the JWT immediately stops
// being accepted, even though the token itself is still cryptographically
// valid until it expires.
export async function revokeSession(sid: string | null | undefined): Promise<void> {
  if (!sid) return;
  try {
    await prisma.userSession.delete({ where: { sid } });
  } catch {
    // Already gone — nothing to do.
  }
}

// Checked on every request that carries a session cookie (see src/proxy.ts).
// A sid is only valid if its row still exists and hasn't expired.
export async function isSessionValid(sid: string | null | undefined): Promise<boolean> {
  if (!sid) return false;
  const session = await prisma.userSession.findUnique({
    where: { sid },
    select: { expiresAt: true },
  });
  if (!session) return false;
  if (session.expiresAt.getTime() < Date.now()) {
    await revokeSession(sid);
    return false;
  }
  return true;
}
