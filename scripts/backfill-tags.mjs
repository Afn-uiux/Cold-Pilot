import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const absolutePath = path.resolve(__dirname, "..", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter });

const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

async function main() {
  const accounts = await prisma.emailAccount.findMany({ where: { warmupFilterTag: "" } });
  for (const a of accounts) {
    let tag;
    let exists;
    do {
      tag = "";
      for (let i = 0; i < 6; i++) tag += chars[Math.floor(Math.random() * chars.length)];
      exists = await prisma.emailAccount.findFirst({ where: { warmupFilterTag: tag } });
    } while (exists);
    await prisma.emailAccount.update({ where: { id: a.id }, data: { warmupFilterTag: tag } });
    console.log(`Updated ${a.email} -> ${tag}`);
  }
  console.log("Done");
}

main().catch(console.error);
