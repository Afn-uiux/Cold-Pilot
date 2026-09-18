// export-sqlite-file.mjs — export ANY SQLite file to JSON, read-only on the source.
// Production-safe twin of scripts/export-sqlite.mjs but parameterized: pass the db path
// and output dir explicitly (prod's dev.db is NOT hardcoded here, so a copy on the box
// can be exported without touching the live file).
// Usage (repo root, where better-sqlite3 is installed): node scripts/export-sqlite-file.mjs <path-to.db> <output-dir>
import Database from "better-sqlite3";
import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.argv[2];
const outDir = process.argv[3];
if (!dbPath || !outDir) {
  console.error("usage: node scripts/export-sqlite-file.mjs <path-to.db> <output-dir>");
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

const db = new Database(path.resolve(dbPath), { readonly: true });
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
console.log(`Exported ${tables.length} tables from ${dbPath} to ${outDir}`);
console.log(JSON.stringify(summary, null, 2));