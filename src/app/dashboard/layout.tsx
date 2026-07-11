import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";
import NotificationBell from "@/components/notification-bell";
import OnboardingWizard from "@/components/onboarding-wizard";
import StateToggle from "./state-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={session.user} />
      <main className="flex-1 min-w-0 lg:ml-[200px] ml-0 pt-4 lg:pt-0 relative">
        <div className="absolute top-4 right-6 z-40">
          <NotificationBell />
        </div>
        {children}
        <OnboardingWizard />
      </main>
      <StateToggle />
    </div>
  );
}
