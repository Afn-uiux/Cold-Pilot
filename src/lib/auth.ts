import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { createSession, revokeSession, isSessionValid, SESSION_TTL_MS } from "./session";
import { verifyToken as verifyTotp } from "./totp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
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
    async signIn({ user }) {
      if (!user.email) return false;
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
    async jwt({ token, user }) {
      // `user` is only present on an actual sign-in, never on token refresh —
      // so this is exactly where a new session should be minted, once.
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
