export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dealRandomTags, parseSeedTags, stringifySeedTags } from "@/lib/seed-tags";

// POST /api/admin/seeds/spin — randomly (re)deal tags across the seed pool.
// Body: { id?: string } — one seed, or every seed with empty tags when
// omitted. The pool is the union of all tags admins entered; each target
// gets 2 random ones. Curated seeds (non-empty tags) are never touched by a
// pool-wide spin — only explicit per-seed spins rewrite them.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;

  const seeds = await prisma.seedInbox.findMany({
    where: id ? { id } : { status: { not: "quarantined" } },
    select: { id: true, email: true, tags: true },
  });
  if (id && seeds.length === 0) {
    return NextResponse.json({ error: "Seed not found" }, { status: 404 });
  }

  const pool = [...new Set(seeds.flatMap((s) => parseSeedTags(s.tags)))];
  if (pool.length === 0) {
    return NextResponse.json(
      { error: "No tags in the pool yet — add tags to at least one seed first" },
      { status: 400 }
    );
  }

  // Pool-wide spin only fills untagged seeds (never rewrites curation).
  // Explicit per-seed spin always re-deals that seed.
  const targets = id ? seeds : seeds.filter((s) => parseSeedTags(s.tags).length === 0);
  let spun = 0;
  for (const target of targets) {
    const dealt = dealRandomTags(pool.filter((t) => {
      // Don't deal a seed its own only-tag back as "random" when the pool
      // has more to offer — keeps spins actually surprising.
      const own = parseSeedTags(target.tags).map((x) => x.toLowerCase());
      return pool.length <= 2 || !own.includes(t.toLowerCase());
    }));
    await prisma.seedInbox.update({
      where: { id: target.id },
      data: { tags: stringifySeedTags(dealt) },
    });
    spun++;
  }

  return NextResponse.json({ success: true, spun, poolSize: pool.length });
}
