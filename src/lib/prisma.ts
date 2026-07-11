import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const relativePath = dbUrl.replace("file:", "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  return new PrismaClient({ adapter });
}

// Production override — if DATABASE_URL starts with postgresql://, use direct PrismaClient
function createClient() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  if (url.startsWith("postgresql")) {
    return new PrismaClient();
  }
  return createPrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
