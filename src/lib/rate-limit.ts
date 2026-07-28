type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) {
    if (now > win.resetAt) windows.delete(key);
  }
}, CLEANUP_INTERVAL);

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

export function rateLimitMiddleware(
  handler: (req: Request, ...args: any[]) => Promise<Response>,
  opts: { max: number; windowMs: number; keyFrom?: (req: Request) => string }
) {
  return async (req: Request, ...args: any[]) => {
    const key = opts.keyFrom
      ? opts.keyFrom(req)
      : req.headers.get("x-forwarded-for") || "anonymous";
    const result = rateLimit(key, opts);

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
