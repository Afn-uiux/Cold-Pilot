import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.env.HOME, "Documents/coldpilot/.env") });
const dir = path.join(process.env.HOME, "Documents/coldpilot/data-export");
const logs = JSON.parse(readFileSync(path.join(dir, "LoginAttempt.json"), "utf8"));
const srcIds = new Set(logs.map((r) => r.id).filter(Boolean));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Phase 1 (read-only, SAFE): name them BEFORE any delete.
const before = await pool.query('SELECT id, email, "createdAt" FROM "LoginAttempt" ORDER BY id');
const stale = before.rows.filter((r) => !srcIds.has(r.id));
console.log("Export rows (source):        ", logs.length);
console.log("Postgres rows (before):      ", before.rows.length);
console.log("Stale rows to delete ():", stale.length);
for (const r of stale) {
  console.log("  WILL-DELETE  id=" + r.id + "  email=" + r.email + "  createdAt=" + r.createdAt);
}

// Phase 2 — ONLY runs if the user already saw Phase 1 AND passed --yes.
if (process.argv.includes("--yes")) {
  const ids = stale.map((r) => r.id);
  const del = await pool.query(
    'DELETE FROM "LoginAttempt" WHERE id = ANY($1::text[])',
    [ids]
  );
  console.log("DELETED rows:", del.rowCount);
  const after = await pool.query('SELECT COUNT(*)::int AS c FROM "LoginAttempt"');
  console.log("Postgres rows (after):       ", after.rows[0].c);
} else {
  console.log("\n(dry-run: nothing deleted. Re-run with --yes to apply the delete above.)");
}

await pool.end();
