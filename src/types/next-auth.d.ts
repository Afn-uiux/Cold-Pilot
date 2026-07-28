import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    sid?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    sid?: string;
  }
}
