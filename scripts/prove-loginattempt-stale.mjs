import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.env.HOME, "Documents/coldpilot/.env") });
const dir = path.join(process.env.HOME, "Documents/coldpilot/data-export");
const logs = JSON.parse(readFileSync(path.join(dir, "LoginAttempt.json"), "utf8"));
const srcIds = new Set(logs.map((r) => r.id).filter(Boolean));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = await pool.query('SELECT id, email, "createdAt" FROM "LoginAttempt" ORDER BY id');
const stale = db.rows.filter((r) => !srcIds.has(r.id));
console.log("LoginAttempt rows in export (source):", logs.length);
console.log("LoginAttempt rows in Postgres:      ", db.rows.length);
console.log("Stale (in Postgres, no source):     ", stale.length);
for (const r of stale) {
  console.log("  STALE id=" + r.id + "  email=" + r.email + "  createdAt=" + r.createdAt);
}
await pool.end();
