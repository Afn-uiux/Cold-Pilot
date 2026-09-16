import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
const adapter = new PrismaPg(url);
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
