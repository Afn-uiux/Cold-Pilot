// Fail-closed validation of security-critical environment variables.
//
// In production a missing/placeholder/weak secret aborts boot outright — it is
// far safer to refuse to start than to run with a forgeable session secret or
// an unusable encryption key. In development we only warn, so local setup stays
// frictionless while still nagging about values that MUST change before deploy.

const PLACEHOLDER_SECRETS = new Set([
  "coldpilot-dev-secret-change-in-production",
  "change-in-production",
  "changeme",
  "secret",
  "development",
  "dev",
]);

function isHex(s: string, bytes: number): boolean {
  return new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(s);
}

function looksPlaceholder(v: string): boolean {
  const t = v.trim().toLowerCase();
  return PLACEHOLDER_SECRETS.has(t) || /change[-_ ]?(me|in[-_ ]?production)/i.test(t);
}

export function assertSecureEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const problems: string[] = [];

  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!authSecret) {
    problems.push("AUTH_SECRET is not set");
  } else if (authSecret.length < 32) {
    problems.push("AUTH_SECRET is shorter than 32 characters — generate one with `openssl rand -base64 32`");
  } else if (looksPlaceholder(authSecret)) {
    problems.push("AUTH_SECRET is a known placeholder — anyone can forge sessions. Generate a unique value with `openssl rand -base64 32`");
  }

  const encKey = process.env.ENCRYPTION_KEY || "";
  if (!encKey) {
    problems.push("ENCRYPTION_KEY is not set (required to encrypt mailbox credentials)");
  } else if (!isHex(encKey, 32)) {
    problems.push("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }

  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret || cronSecret.length < 16) {
    problems.push("CRON_SECRET is missing or too short (>= 16 chars) — cron/warmup endpoints must not be publicly triggerable");
  }

  if (problems.length === 0) return;

  const banner =
    "\n========================================================================\n" +
    "[env-guard] Insecure security configuration detected:\n  - " +
    problems.join("\n  - ") +
    "\n========================================================================\n";

  if (isProd) {
    throw new Error(
      banner + "Refusing to start in production. Fix the above before deploying.\n"
    );
  }
  console.warn(banner + "(development mode: continuing — these MUST be fixed before production)\n");
}
