// READ-ONLY proof. No writes to any DB. Only: local JSON reads + Postgres SELECT.
// Goal: name the orphan Deal(s) by id, show the live Deal_leadId_fkey target,
// and show the missing Lead id — all computed from the files, nothing hand-typed.
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.env.HOME || "C:/Users/user/Documents/coldpilot", ".env") });

const dir = path.join(process.env.HOME || "C:/Users/user/Documents/coldpilot", "data-export");
const dealRows = JSON.parse(readFileSync(path.join(dir, "Deal.json"), "utf8"));
const leadRows = JSON.parse(readFileSync(path.join(dir, "Lead.json"), "utf8"));

const dealIds = new Set(dealRows.map((d) => d.id));
const dealLeadIds = new Set(dealRows.map((d) => d.leadId).filter(Boolean));
const leadIds = new Set(leadRows.map((l) => l.id));

console.log("Deal rows in file:", dealRows.length);
console.log("Deal ids in file:", dealIds.size);
console.log("Deal leadId values set (non-null):", dealLeadIds.size);
console.log("Lead ids in file:", leadIds.size);

console.log("\n=== ORPHAN computation (Deal.leadId that is NOT in Lead ids) ===");
const orphans = [...dealLeadIds].filter((lid) => !leadIds.has(lid));
console.log("orphan leadId values:", orphans.length ? orphans : "(none)");

console.log("\n=== The Deal rows that reference each orphan leadId (id + exact leadId from file) ===");
const seen = new Set();
for (const d of dealRows) {
  if (d.leadId && !leadIds.has(d.leadId) && !seen.has(d.id)) {
    seen.add(d.id);
    console.log("Deal id:", d.id, "  leadId:", d.leadId, "  name:", d.name);
  }
}

console.log("\n=== Live Postgres FK definition for Deal.leadId ===");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const q = await pool.query(`
  SELECT tc.constraint_name,
         kcu.table_name AS child, kcu.column_name AS fk_col,
         ccu.table_name AS ref_table, ccu.column_name AS ref_col
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'Deal'
`);
for (const r of q.rows) {
  console.log(`FK ${r.constraint_name}: ${r.child}.${r.fk_col}  ->  ${r.ref_table}.${r.ref_col}`);
}
await pool.end();
