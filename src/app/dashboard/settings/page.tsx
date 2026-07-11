import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsTabs from "@/components/settings-tabs";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, createdAt: true },
  });

  if (!user) return null;

  return <SettingsTabs user={user} />;
}
