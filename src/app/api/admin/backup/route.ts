export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { copyFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const BACKUPS_DIR = join(process.cwd(), "backups");
const DB_PATH = join(process.cwd(), "dev.db");
const MAX_BACKUPS = 10;

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `coldpilot-${timestamp}.db`;
    const backupPath = join(BACKUPS_DIR, backupName);

    copyFileSync(DB_PATH, backupPath);

    // Prune old backups
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith("coldpilot-") && f.endsWith(".db"))
      .map(f => ({ name: f, time: statSync(join(BACKUPS_DIR, f)).mtime }))
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    for (const file of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(BACKUPS_DIR, file.name));
    }

    const size = statSync(backupPath).size;
    return NextResponse.json({
      success: true,
      file: backupName,
      size: `${(size / 1024).toFixed(1)} KB`,
      backups: Math.min(files.length, MAX_BACKUPS),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Backup failed" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith("coldpilot-") && f.endsWith(".db"))
      .map(f => {
        const stat = statSync(join(BACKUPS_DIR, f));
        return { name: f, size: `${(stat.size / 1024).toFixed(1)} KB`, created: stat.mtime };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return NextResponse.json({ backups: files });
  } catch {
    return NextResponse.json({ backups: [] });
  }
}
