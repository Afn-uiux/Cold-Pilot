type Window = { count: number; resetAt: number };

// Bound the in-memory fallback so an attacker cannot grow it unbounded by
// rotating spoofed keys (memory-exhaustion DoS). When this is exceeded the
// oldest entries are evicted.
const MAX_WINDOWS = 100_000;
const windows = new Map<string, Window>();

const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) {
    if (now > win.resetAt) windows.delete(key);
  }
  if (windows.size > MAX_WINDOWS) {
    const extra = windows.size - MAX_WINDOWS;
    let removed = 0;
    for (const key of windows.keys()) {
      if (removed >= extra) break;
      windows.delete(key);
      removed++;
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get the client IP for rate-limiting / abuse purposes.
 *
 * SECURITY: `X-Forwarded-For`/`X-Real-IP` are client-controlled and must NOT
 * be trusted for security decisions unless the request provably came from a
 * known reverse proxy (which this app does not trust by default). We therefore
 * fall back to the socket remote address supplied by Next/Node when no trusted
 * proxy is configured.
 *
 * `forwarded`/`req` accept a Headers-like object so this works in both edge
 * (proxy.ts) and node (route handlers) runtimes.
 */
export function getClientIp(
  forwarded: { get(name: string): string | null } | null | undefined
): string {
  // If the deployment explicitly trusts an upstream proxy, honour the first
  // XFF entry. Otherwise use the socket address (unavailable in some edge
  // contexts, where we fall back to a stable per-process placeholder).
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (trustProxy && forwarded) {
    const xff = forwarded.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim() || "unknown";
  }
  return process.env.NODE_ENV === "production"
    ? (forwarded?.get("x-real-ip")?.split(",")[0]?.trim() || "unknown")
    : "unknown";
}

let redis: any = null;
let redisChecked = false;

async function getRedis() {
  if (redisChecked) return redis;
  redisChecked = true;
  const url = process.env.REDIS_URL || "";
  if (!url || (url === "redis://localhost:6379" && process.env.NODE_ENV !== "production")) {
    return null;
  }
  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    return redis;
  } catch {
    return null;
  }
}

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number } = { max: 5, windowMs: 60_000 }
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const win = windows.get(key);

  if (!win || now > win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (win.count >= opts.max) {
    return { allowed: false, retryAfterMs: win.resetAt - now };
  }

  win.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const win = windows.get(key);

  if (!win || now > win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, resetAt: now + opts.windowMs };
  }

  if (win.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: win.resetAt };
  }

  win.count++;
  return { ok: true, remaining: opts.max - win.count, resetAt: win.resetAt };
}

/**
 * Redis-backed rate limiter with an in-memory fallback. The in-memory
 * version is per-process, which silently under-counts (and thus allows more
 * requests) once the app runs on multiple instances. Redis makes the limit
 * global across all servers. If Redis is unreachable we degrade to memory so
 * the app never hard-fails on a rate check.
 */
export async function rateLimitAsync(
  key: string,
  opts: { max: number; windowMs: number }
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const client = await getRedis();
  if (!client) return rateLimit(key, opts);

  try {
    const res: number = await client.incr(`rl:${key}`);
    if (res === 1) {
      await client.pexpire(`rl:${key}`, opts.windowMs);
    }
    const ok = res <= opts.max;
    return {
      ok,
      remaining: Math.max(0, opts.max - res),
      resetAt: Date.now() + opts.windowMs,
    };
  } catch {
    return rateLimit(key, opts);
  }
}

export function rateLimitMiddleware(
  handler: (req: Request, ...args: any[]) => Promise<Response>,
  opts: { max: number; windowMs: number; keyFrom?: (req: Request) => string }
) {
  return async (req: Request, ...args: any[]) => {
    const key = opts.keyFrom
      ? opts.keyFrom(req)
      : `anon:${getClientIp(req.headers as unknown as { get(name: string): string | null })}`;
    const result = await rateLimitAsync(key, opts);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      });
    }

    const res = await handler(req, ...args);
    return res;
  };
}
