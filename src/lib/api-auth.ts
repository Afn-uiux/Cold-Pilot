import { auth } from "./auth";
import { prisma } from "./prisma";
import { NextRequest } from "next/server";

export async function authenticateRequest(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const key = await prisma.apiKey.findUnique({ where: { key: apiKey } });
  if (!key) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { userId: key.userId, apiKeyId: key.id, scopes: key.scopes };
}
