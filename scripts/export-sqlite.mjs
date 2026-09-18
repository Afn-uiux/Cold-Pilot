// One-shot export of the local SQLite dev.db into JSON files for the Postgres port.
// Run BEFORE `npm install` (needs better-sqlite3, still in node_modules).
// Usage (your own terminal, repo root): node scripts/export-sqlite.mjs
import Database from "better-sqlite3";
import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "dev.db");
const outDir = path.resolve(__dirname, "..", "data-export");
mkdirSync(outDir, { recursive: true });

const db = new Database(dbPath, { readonly: true });
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name"
  )
  .all()
  .map((r) => r.name);

const summary = {};
for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM "${t}"`).all();
  writeFileSync(
    path.join(outDir, `${t}.json`),
    JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2)
  );
  summary[t] = rows.length;
}
db.close();
console.log(`Exported ${tables.length} tables to ${outDir}`);
console.log(JSON.stringify(summary, null, 2));
