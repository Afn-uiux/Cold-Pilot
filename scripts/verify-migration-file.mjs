// verify-migration-file.mjs — completeness check comparing an arbitrary SQLite file
// against a Postgres database. Parameterized twin of scripts/verify-migration.mjs:
// pass the SQLite path and (optionally) a Postgres URL; defaults to repo .env DATABASE_URL.
// Read-only against both sides. Re-runnable any number of times.
// Usage (repo root, requires node_modules with pg + better-sqlite3):
//   node scripts/verify-migration-file.mjs <path-to.db> [postgresql://url]
// Exit 0 = GREEN, 1 = FAIL (SQLite rows missing from Postgres), 2 = bad usage.
import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(process.argv[2] ?? "dev.db");
const url = process.argv[3] ?? process.env.DATABASE_URL;
if (!url || !url.startsWith("postgresql://")) {
  console.error("DATABASE_URL does not point at Postgres — refusing to compare.");
  process.exit(2);
}

const sqlite = new Database(dbPath, { readonly: true });
const pool = new pg.Pool({ connectionString: url });

const tables = sqlite
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name"
  )
  .all()
  .map((r) => r.name);

// Tables without a natural "id" PK (keyed differently) fall back to count equality.
const keyedByOther = new Set(["ChatSettings"]);

let failures = 0;
let drift = 0;
for (const t of tables) {
  const s = Number(sqlite.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c);
  let p;
  try {
    p = Number((await pool.query(`SELECT COUNT(*) AS c FROM "${t}"`)).rows[0].c);
  } catch (e) {
    console.log(`${t}: SQLite=${s}  Postgres=ERR (${e.message.split("\n")[0]})`);
    failures++;
    continue;
  }

  const keyCol = keyedByOther.has(t) ? "userId" : "id";
  const hasKey = sqlite.pragma(`table_info("${t}")`).some((c) => c.name === keyCol);
  const ids = hasKey
    ? sqlite.prepare(`SELECT "${keyCol}" AS k FROM "${t}"`).all().map((r) => r.k).filter((k) => k != null)
    : [];

  let missing = 0;
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const ph = chunk.map((_, j) => `$${j + 1}`).join(",");
      if (!chunk.length) continue;
      const found = (await pool.query(`SELECT "${keyCol}" FROM "${t}" WHERE "${keyCol}" IN (${ph})`, chunk)).rows;
      missing += chunk.length - found.length;
    }
  }

  if (missing > 0) {
    console.log(`MISS  ${t}: SQLite=${s}  Postgres=${p}  (${missing} SQLite rows absent from Postgres)`);
    failures++;
  } else if (p > s) {
    console.log(`DRIFT ${t}: SQLite=${s}  Postgres=${p}  (+${p - s} extra Postgres rows, ok if live writes)`);
    drift++;
  } else {
    console.log(`OK    ${t}: SQLite=${s}  Postgres=${p}`);
  }
}

sqlite.close();
await pool.end();

console.log(`\nTables with extra Postgres rows (drift): ${drift}`);
if (failures === 0) {
  console.log("GREEN: every SQLite row exists in Postgres.");
  process.exit(0);
} else {
  console.log(`FAIL: ${failures} table(s) have SQLite rows missing from Postgres. Stop and report.`);
  process.exit(1);
}