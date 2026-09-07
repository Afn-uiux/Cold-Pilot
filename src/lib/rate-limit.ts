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
 * SECURITY: `X-Forwarded-For` is a client-appendable list — the LEFTMOST entry
 * is fully attacker-controlled, so trusting it lets anyone mint a fresh "IP"
 * per request and defeat every per-IP limit. We therefore:
 *   1. Prefer `cf-connecting-ip` (Cloudflare sets it and overwrites any client
 *      copy — trustworthy as long as the origin only accepts Cloudflare traffic).
 *   2. Otherwise take the RIGHTMOST XFF hop — the one appended by our own proxy
 *      — optionally stepping back TRUSTED_PROXY_HOPS entries for multi-proxy
 *      chains. Never the leftmost.
 *   3. Fall back to `x-real-ip` (last value), then to a placeholder.
 *
 * Proxy trust is STRICTLY OPT-IN. Production no longer implies a trusted proxy
 * boundary (a direct connection that bypasses the proxy makes every forwarding
 * header attacker-forgeable); `TRUST_PROXY="true"` must be set explicitly AND
 * the origin must actually be unreachable except through that proxy.
 *
 * `REQUIRE_PROXY="true"` (with `TRUST_PROXY="true"`) hardens further: a request
 * that carries no proof of having passed through the trusted proxy (no
 * cf-connecting-ip / cf-ray / x-vercel-forwarded-for) is treated as having an
 * unknown client IP. That collapses every per-IP limiter onto one shared
 * "unknown" bucket — which is stricter than trusting a spoofed value, never
 * looser.
 */
export function getClientIp(
  forwarded: { get(name: string): string | null } | null | undefined
): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (!forwarded || !trustProxy) return "unknown";

  const requireProxy = process.env.REQUIRE_PROXY === "true";
  if (
    requireProxy &&
    !forwarded.get("cf-connecting-ip") &&
    !forwarded.get("cf-ray") &&
    !forwarded.get("x-vercel-forwarded-for")
  ) {
    return "unknown";
  }

  const cf = forwarded.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();

  const xff = forwarded.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
      return parts[Math.max(0, parts.length - hops)] || "unknown";
    }
  }

  const real = forwarded.get("x-real-ip");
  if (real) return real.split(",").map((s) => s.trim()).filter(Boolean).pop() || "unknown";

  return "unknown";
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
