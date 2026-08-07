import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { createSession, revokeSession, SESSION_TTL_MS } from "./session";

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;
        if (user.deletedAt) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

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
        select: { deletedAt: true },
      });
      if (existing?.deletedAt) return false;
      return true;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
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
      }
      session.sid = token.sid as string | undefined;
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
  trustHost: true,
});
