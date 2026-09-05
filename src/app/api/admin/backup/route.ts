export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join, resolve, sep } from "path";

const BACKUPS_DIR = join(process.cwd(), "backups");
const DB_PATH = join(process.cwd(), "dev.db");
const MAX_BACKUPS = 10;

// Only files this route itself created may be downloaded. The timestamp shape
// comes from POST below; anything else is rejected before touching the disk.
const BACKUP_NAME_RE = /^coldpilot-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    mkdirSync(BACKUPS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `coldpilot-${timestamp}.db`;
    const backupPath = join(BACKUPS_DIR, backupName);

    // Safe online backup (SQLite backup API), NOT a raw file copy: the DB is
    // live and WAL-mode, so copyFileSync could capture a torn page and hand
    // you a corrupt "backup" that only fails on restore day.
    const src = new Database(DB_PATH, { readonly: true });
    try {
      await src.backup(backupPath);
    } finally {
      src.close();
    }

    // Verify before trusting: integrity + same table count as the live DB.
    const check = new Database(backupPath, { readonly: true });
    let integrity = "";
    let tables = 0;
    try {
      integrity = (check.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
      tables = (check.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'").get() as { c: number }).c;
    } finally {
      check.close();
    }
    const live = new Database(DB_PATH, { readonly: true });
    let liveTables = 0;
    try {
      liveTables = (live.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'").get() as { c: number }).c;
    } finally {
      live.close();
    }
    if (integrity !== "ok" || tables !== liveTables) {
      unlinkSync(backupPath);
      throw new Error(`verification failed (integrity=${integrity}, tables=${tables}/${liveTables})`);
    }

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
    console.error("Backup failed:", err);
    return NextResponse.json({ error: "Backup failed. Check the server logs." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const download = req.nextUrl.searchParams.get("download");

  // Download a backup file to the admin's machine (the off-server copy for
  // the survival kit). Name is strictly validated and resolved inside the
  // backups dir — no path traversal possible.
  if (download) {
    if (!BACKUP_NAME_RE.test(download)) {
      return NextResponse.json({ error: "Invalid backup name" }, { status: 400 });
    }
    const resolved = resolve(BACKUPS_DIR, download);
    if (!resolved.startsWith(resolve(BACKUPS_DIR) + sep)) {
      return NextResponse.json({ error: "Invalid backup name" }, { status: 400 });
    }
    try {
      const stat = statSync(resolved);
      if (!stat.isFile()) throw new Error("not a file");
      const { readFileSync } = await import("fs");
      const data = readFileSync(resolved);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "application/x-sqlite3",
          "Content-Disposition": `attachment; filename="${download}"`,
          "Content-Length": String(data.length),
        },
      });
    } catch {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
  }

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
