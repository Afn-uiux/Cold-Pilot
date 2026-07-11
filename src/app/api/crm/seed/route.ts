import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const STAGES = ["lead", "interested", "meeting_booked", "meeting_completed", "won", "no_show", "out_of_office", "wrong_person", "not_interested", "lost"];

const SAMPLE_COMPANIES = [
  { name: "Acme Corp — Q3 Renewal", value: 12000, stage: "lead" },
  { name: "Globex Inc — Enterprise Plan", value: 45000, stage: "interested" },
  { name: "Initech — Expansion", value: 8000, stage: "meeting_booked" },
  { name: "Hooli — New Onboarding", value: 28000, stage: "won", status: "won" },
  { name: "Cyberdyne — Trial Close", value: 15000, stage: "not_interested", status: "lost" },
  { name: "Umbrella Corp — Pilot", value: 6000, stage: "lead" },
  { name: "Wonka Industries — Full Suite", value: 35000, stage: "interested" },
  { name: "Stark Industries — Security Audit", value: 22000, stage: "meeting_booked" },
  { name: "Oscorp — Beta Program", value: 4000, stage: "lead" },
  { name: "Aperture Science — Research Grant", value: 95000, stage: "won", status: "won" },
  { name: "Wayne Enterprises — Logistics", value: 18000, stage: "interested" },
  { name: "LexCorp — Migration", value: 55000, stage: "meeting_completed" },
  { name: "Massive Dynamic — Integration", value: 33000, stage: "lead" },
  { name: "Soylent Corp — Annual Review", value: 11000, stage: "out_of_office" },
  { name: "Tyrell Corp — Renewal", value: 7500, stage: "lost", status: "lost" },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  let pipeline = await prisma.pipeline.findFirst({ where: { userId } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: { userId, name: "Sales Pipeline", stages: JSON.stringify(STAGES) },
    });
  } else {
    const currentStages: string[] = JSON.parse(pipeline.stages);
    if (currentStages.length !== STAGES.length || currentStages.some((s, i) => s !== STAGES[i])) {
      pipeline = await prisma.pipeline.update({ where: { id: pipeline.id }, data: { stages: JSON.stringify(STAGES) } });
    }
  }

  const existing = await prisma.deal.count({ where: { pipelineId: pipeline.id } });
  if (existing === 0) {
    for (const company of SAMPLE_COMPANIES) {
      await prisma.deal.create({
        data: { userId, pipelineId: pipeline.id, name: company.name, value: company.value, stage: company.stage, status: (company as any).status || "open", notes: "Sample deal for demo purposes." },
      });
    }
  }

  const pipelines = await prisma.pipeline.findMany({ where: { userId }, include: { _count: { select: { deals: true } } } });

  return NextResponse.json({ pipelines, pipelineId: pipeline.id });
}
