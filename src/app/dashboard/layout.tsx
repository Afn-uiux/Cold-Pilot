import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "./sidebar";
import NotificationBell from "@/components/notification-bell";
import OnboardingWizard from "@/components/onboarding-wizard";
import StateToggle from "./state-toggle";
import CommandPalette from "@/components/command-palette";
import TrialBanner from "@/components/trial-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { completedOnboarding: true, emailVerified: true },
  });
  const needsOnboarding = !user?.completedOnboarding;

  // No progress until the email is verified. Redundant with the login block,
  // but guards any session minted before this change or via a stray path.
  if (!user?.emailVerified) redirect("/auth/login?verify=required");

  if (needsOnboarding) {
    return (
      <div className="flex min-h-screen">
        <OnboardingWizard />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={session.user} />
      <main className="flex-1 min-w-0 lg:ml-[200px] ml-0 pt-4 lg:pt-0 relative">
        <div className="absolute top-4 right-6 z-40">
          <NotificationBell />
        </div>
        <div className="px-6 lg:px-10 pt-4">
          <TrialBanner />
        </div>
        {children}
        <OnboardingWizard />
      </main>
      <StateToggle />
      <CommandPalette />
    </div>
  );
}
