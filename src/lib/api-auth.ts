import { auth } from "./auth";
import { prisma } from "./prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// API keys are stored only as a SHA-256 digest so a DB leak does not expose
// usable credentials. The plaintext is shown exactly once, at creation.
export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface AuthContext {
  userId: string;
  apiKeyId?: string;
  scopes: string[];
}

// A logged-in dashboard session is implicitly granted full scope. API keys are
// granted only the scopes recorded at creation (see requireScope).
const SESSION_SCOPES = ["read", "write"];

export function parseScopes(scopes: string | string[] | null | undefined): string[] {
  if (!scopes) return [];
  const list = Array.isArray(scopes) ? scopes : scopes.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const norm = s.trim().toLowerCase();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/**
 * Resolve the caller's identity: a browser session takes precedence; otherwise
 * an `x-api-key` header (validated against its SHA-256 digest) authenticates
 * server-to-server requests. Returns null when neither factor is present/valid.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, scopes: SESSION_SCOPES };
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const key = await prisma.apiKey.findUnique({ where: { key: hashApiKey(apiKey) } });
  if (!key) return null;

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: key.userId, apiKeyId: key.id, scopes: parseScopes(key.scopes) };
}

export function hasScope(ctx: AuthContext | null, scope: string): boolean {
  return !!ctx && ctx.scopes.includes(scope);
}

/**
 * Central scope gate. Every handler that accepts API-key (or session) auth must
 * call this so a narrow-scoped key can never act with implicit wider access.
 * Returns a NextResponse to short-circuit with, or null when access is granted.
 */
export function requireScope(ctx: AuthContext | null, scope: string): NextResponse | null {
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasScope(ctx, scope)) {
    return NextResponse.json({ error: `Forbidden: key lacks '${scope}' scope` }, { status: 403 });
  }
  return null;
}

// Legacy alias used by any existing call sites.
export async function authenticateRequest(req: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx) return null;
  return { userId: ctx.userId, apiKeyId: ctx.apiKeyId, scopes: ctx.scopes };
}
