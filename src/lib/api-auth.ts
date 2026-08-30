import { auth } from "./auth";
import { prisma } from "./prisma";
import { NextRequest } from "next/server";
import crypto from "crypto";

// API keys are stored only as a SHA-256 digest so a DB leak does not expose
// usable credentials. The plaintext is shown exactly once, at creation.
export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function authenticateRequest(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const key = await prisma.apiKey.findUnique({ where: { key: hashApiKey(apiKey) } });
  if (!key) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { userId: key.userId, apiKeyId: key.id, scopes: key.scopes };
}
