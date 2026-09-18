// One-shot import of data-export/*.json into Postgres.
// Run AFTER `npx prisma migrate deploy` (tables must exist).
// Usage (your own terminal, repo root): node scripts/import-postgres.mjs
// Reads DATABASE_URL from .env. Safe to re-run: conflicting rows are skipped.
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "data-export");

// Parents before children (matches the foreign-key graph).
const ORDER = [
  "User",
  "MailboxIdentity",
  "SignupSignal",
  "BlockedSignal",
  "LoginAttempt",
  "Account",
  "Session",
  "VerificationToken",
  "UserSession",
  "EmailAccount",
  "SeedInbox",
  "WarmupLog",
  "WarmupContent",
  "Campaign",
  "CampaignSchedule",
  "CampaignStep",
  "Lead",
  "EmailLog",
  "Pipeline",
  "Deal",
  "Task",
  "Integration",
  "Webhook",
  "ApiKey",
  "Notification",
  "Suppression",
  "Template",
  "DomainReputation",
  "BounceEvent",
  "SchedulerLock",
  "CreditTransaction",
  "BachsWebhookEvent",
  "PaymentEvent",
  "GlobalLeadIntel",
  "WaitlistEntry",
  "ChatMessage",
  "ChatSettings",
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const pool = new pg.Pool({ connectionString: url });

let total = 0;
let skipped = 0;
for (const t of ORDER) {
  let rows;
  try {
    rows = JSON.parse(readFileSync(path.join(outDir, `${t}.json`), "utf8"));
  } catch {
    continue; // no file for this table — nothing was in it, skip
  }
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  for (const r of rows) {
    const vals = cols.map((c) => (r[c] === undefined ? null : r[c]));
    const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
    try {
      await pool.query(
        `INSERT INTO "${t}" (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
        vals
      );
    } catch (err) {
      const isFK = err?.code === "23503";
      if (isFK) {
        skipped++;
        console.warn(
          `  SKIP ${t} row ${r?.id ?? r?.leadId ?? ""} -> orphan FK ${err.message.split("constraint")[1]?.split('"')[1] ?? err.message}`
        );
        continue;
      }
      throw err;
    }
  }
  total += rows.length;
  console.log(`${t}: ${rows.length}`);
}
await pool.end();
console.log(`Imported ${total} rows.`);
