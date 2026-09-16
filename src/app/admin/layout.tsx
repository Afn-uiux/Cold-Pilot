export const runtime = "nodejs";

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "./_components/admin-sidebar";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-cream)", fontFamily: "var(--font-sans)" }}>
      <AdminSidebar />
      <main className="flex-1 min-w-0 lg:ml-[200px] ml-0 pt-4 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
