export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { SIGNUP_CREDITS } from "@/lib/plans";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      completedOnboarding: true,
      onboardingSource: true,
      onboardingWebsite: true,
      onboardingGoals: true,
      creditBalance: true,
    },
  });

  let goals: string[] = [];
  try {
    goals = user?.onboardingGoals ? JSON.parse(user.onboardingGoals) : [];
  } catch {}

  return NextResponse.json({
    completed: user?.completedOnboarding ?? false,
    source: user?.onboardingSource ?? null,
    website: user?.onboardingWebsite ?? null,
    goals,
    creditBalance: user?.creditBalance ?? 0,
    signupCredits: SIGNUP_CREDITS,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let source: string | null = null;
  let website: string | null = null;
  let goals: string[] = [];

  try {
    const body = await req.json();
    if (typeof body.source === "string" && body.source.trim()) source = body.source.trim().slice(0, 200);
    if (typeof body.website === "string" && body.website.trim()) website = body.website.trim().slice(0, 300);
    if (Array.isArray(body.goals)) {
      goals = body.goals
        .filter((g: unknown): g is string => typeof g === "string" && g.trim().length > 0)
        .slice(0, 3)
        .map((g: string) => g.trim().slice(0, 200));
    }
  } catch {}

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      completedOnboarding: true,
      onboardingSource: source,
      onboardingWebsite: website,
      onboardingGoals: goals.length > 0 ? JSON.stringify(goals) : null,
    },
  });

  return NextResponse.json({ success: true });
}
