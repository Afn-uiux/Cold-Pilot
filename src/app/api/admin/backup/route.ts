export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join, resolve, sep } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const BACKUPS_DIR = join(process.cwd(), "backups");
const MAX_BACKUPS = 10;

// Only files this route itself created may be downloaded. The timestamp shape
// comes from POST below; anything else is rejected before touching the disk.
const BACKUP_NAME_RE = /^coldpilot-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.dump$/;

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

async function createBackup(): Promise<{ file: string; size: number }> {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const file = `coldpilot-${timestamp}.dump`;
  const path = join(BACKUPS_DIR, file);
  // pg_dump: custom format ("directory-safe", compressible, restorable with pg_restore).
  await execFileAsync("pg_dump", ["--format=custom", "--file", path, url]);
  const size = statSync(path).size;
  if (size <= 0) {
    unlinkSync(path);
    throw new Error("pg_dump produced an empty file");
  }
  return { file, size };
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { file, size } = await createBackup();

    // Prune old backups
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => /^coldpilot-.*\.dump$/.test(f))
        .map(f => ({ name: f, time: statSync(join(BACKUPS_DIR, f)).mtime }))
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    for (const file of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(BACKUPS_DIR, file.name));
    }

    return NextResponse.json({
      success: true,
      file,
      size: `${(size / 1024).toFixed(1)} KB`,
      backups: Math.min(files.length, MAX_BACKUPS),
    });
  } catch (err) {
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
      const contentType = "application/octet-stream";
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": contentType,
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
      .filter(f => /^coldpilot-.*\.dump$/.test(f))
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