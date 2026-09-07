import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { createSession, revokeSession, isSessionValid, SESSION_TTL_MS } from "./session";
import { verifyToken as verifyTotp } from "./totp";
import { TRIAL_MS } from "./trial";
import { computeSignupRisk, voidTrial } from "./fraud";
import { sendEmailSafe } from "./email/send";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Two-factor code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;
        if (user.deletedAt) return null;

        // No login until the email is verified. This is enforced here (not just
        // in the UI) so an unverified user can never mint a session, even via the
        // API route. The login action separately distinguishes this case to show
        // a "verify your email" + resend state instead of a generic failure.
        if (!user.emailVerified) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        // Enforce 2FA server-side: password alone never yields a session when
        // TOTP is enabled. A wrong/missing code fails here, before any session
        // is minted (the /api/auth/2fa/verify endpoint is not part of login).
        if (user.totpSecret) {
          const code = typeof credentials.code === "string" ? credentials.code : "";
          if (!code || !verifyTotp(user.totpSecret, code)) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user?.email) return false;
      if (account?.provider === "google") {
        return provisionGoogleUser({
          email: typeof profile?.email === "string" && profile.email ? (profile.email as string) : user.email,
          name: typeof user.name === "string" ? user.name : null,
          image: typeof user.image === "string" ? user.image : null,
        });
      }
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { deletedAt: true, totpSecret: true },
      });
      if (existing?.deletedAt) return false;
      // 2FA bypass hardening: no provider may mint a session past TOTP. The
      // Credentials provider enforces the code itself, and this guard keeps any
      // future/provisioned provider from skipping it.
      if (existing?.totpSecret) return false;
      return true;
    },
    async session({ session, token }) {
      // Server-side session revocation enforcement: a token is only usable if
      // its UserSession row still exists and hasn't expired. Without this the
      // JWT remains valid for the full TTL even after sign-out, password reset
      // or an admin kill (the row alone is never consulted elsewhere).
      const sid = token.sid as string | undefined;
      // Bind the sid to the token's subject: a valid sid alone is not enough,
      // it must belong to this exact user. Prevents session forgery where a
      // crafted `sub` is paired with an attacker's own legitimate sid.
      const sidValid = sid ? await isSessionValid(sid, token.sub) : false;
      if (token.sub && session.user && sidValid) {
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, deletedAt: true },
        });
        if (!user || user.deletedAt) {
          session.user = undefined as unknown as typeof session.user;
          return session;
        }
        session.user.id = token.sub;
        session.user.role = user.role || "user";
      } else {
        session.user = undefined as unknown as typeof session.user;
      }
      session.sid = sid;
      return session;
    },
    async jwt({ token, user, account }) {
      // `user` is only present on an actual sign-in, never on token refresh —
      // so this is exactly where a new session should be minted, once.
      if (account?.provider === "google" && user?.email) {
        // Google path: the sign-in callback just provisioned/validated the DB
        // account, but NextAuth passes us the OAuth profile user, not the DB
        // row. Resolve the real user id by email so token.sub (and thus the
        // session callback's DB checks) points at the actual account.
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase().trim() },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.sid = crypto.randomUUID();
          token.role = dbUser.role || "user";
          await createSession(dbUser.id, token.sid as string);
        }
        return token;
      }
      if (user?.id) {
        token.sub = user.id;
        token.sid = crypto.randomUUID();
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role || "user";
        await createSession(user.id, token.sid as string);
      }
      return token;
    },
  },
  events: {
    // Fires on both explicit signOut() calls and NextAuth's own session
    // teardown. Revoking the DB row here is what actually invalidates the
    // session server-side — clearing cookies alone only affects this browser.
    async signOut(message) {
      const sid = "token" in message ? (message.token?.sid as string | undefined) : undefined;
      await revokeSession(sid);
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_TTL_MS / 1000,
  },
  // Use a stable, explicit session-cookie name that matches what proxy.ts
  // reads. In development (localhost / Cloudflare tunnel) the tunnel presents
  // HTTPS but the origin is localhost, so a __Secure- cookie wouldn't work for
  // testing; use the plain name there. In production keep the __Secure- prefix
  // so the browser refuses to send the session over insecure connections.
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/" },
    },
  },
  trustHost: true,
});

// Wire-up for Google logins (previously the button existed but the flow died
// at the session step: NextAuth sets token.sub from the OAuth profile, which
// never matched a real User row, so the session callback killed every Google
// session. We now create the account here, in the signIn callback, so the jwt
// callback can resolve a real id.)
async function provisionGoogleUser(opts: {
  email: string;
  name: string | null;
  image: string | null;
}): Promise<boolean> {
  const email = opts.email.trim().toLowerCase();
  try {
    // Note: this beta's signIn callback exposes no request headers, so the
    // signup IP signal is unavailable to Google signups. The IP-based risk
    // checks (blocked_ip, ip_repeat) simply miss; email uniqueness and the
    // domain blocklist still apply.
    const ip: string | null = null;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { deletedAt: true, totpSecret: true, emailVerified: true },
    });
    if (existing) {
      if (existing.deletedAt) return false;
      // 2FA bypass hardening: Google has no TOTP step, so an account with 2FA
      // enabled must log in with email + password + code instead.
      if (existing.totpSecret) return false;
      return true;
    }

    // New account. Google already verified the email address, so no
    // verification-email step is needed — it counts as verified from birth,
    // which flips ensureSignupCredits on (same incentive as an email signup
    // that clicks the link).
    const user = await prisma.user.create({
      data: {
        name: opts.name || null,
        image: opts.image || null,
        email,
        emailVerified: new Date(),
        trialEndsAt: new Date(Date.now() + TRIAL_MS),
        signupIp: ip && ip !== "unknown" ? ip : null,
      },
    });

    // Run the same risk gate as an email signup (device fingerprints don't
    // exist for OAuth logins, so the only signals are IP/domain lineage). A
    // hard blocklist hit bans the account and denies the login; anything else
    // just flags it for admin review.
    const risk = await computeSignupRisk({ userId: user.id, email, fingerprint: null, ip });
    if (risk.flags.includes("blocked_device") || risk.flags.includes("blocked_ip")) {
      await voidTrial(user.id, "blocklist_hit");
      await prisma.user.update({
        where: { id: user.id },
        data: { riskStatus: "banned", riskScore: risk.score, riskFlags: JSON.stringify(risk.flags) },
      });
      return false;
    }
    if (risk.score > 0 || risk.status === "flagged") {
      await prisma.user.update({
        where: { id: user.id },
        data: { riskScore: risk.score, riskFlags: JSON.stringify(risk.flags), riskStatus: risk.status },
      });
    }
    await prisma.signupSignal.create({
      data: { userId: user.id, deviceFingerprint: null, ip: ip && ip !== "unknown" ? ip : null },
    });

    sendEmailSafe(email, "welcome");
    return true;
  } catch (err) {
    console.error("[auth] google provisioning failed:", err);
    return false;
  }
}
