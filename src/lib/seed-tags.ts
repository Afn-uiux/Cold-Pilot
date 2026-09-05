// Seed content tags: parsing, validation, and random spins. Tags live on
// SeedInbox.tags as a JSON array. The warmup engine spins one tag at random
// into each subject line and appends the set at the end of the body, so
// warmup emails never repeat identical content (a spam-filter signal).

const MAX_TAGS = 10;
const MAX_TAG_LEN = 30;

export function parseSeedTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return normalizeTags(raw.filter((t): t is string => typeof t === "string"));
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Accept JSON arrays (storage format) or comma-separated input (UI).
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeTags(parsed.filter((t): t is string => typeof t === "string"));
        }
      } catch {
        // fall through to comma split
      }
    }
    return normalizeTags(trimmed.split(","));
  }
  return [];
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const clean = t.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LEN);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function stringifySeedTags(tags: string[]): string {
  return JSON.stringify(normalizeTags(tags));
}

// Per-seed tracking code: unique, auto-generated at creation, admin-editable
// (mirrors EmailAccount.warmupFilterTag — same 6-char scheme so codes look
// and filter identically across user mailboxes and seeds).
export function generateFilterTag(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let tag = "";
  for (let i = 0; i < 6; i++) tag += chars[Math.floor(Math.random() * chars.length)];
  return tag;
}

// Spin: pick one tag at random for the subject line. Returns null when the
// seed carries no tags (caller sends content unchanged).
export function spinSubjectTag(tags: string[]): string | null {
  const list = normalizeTags(tags);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// Spin: deal a random subset from the platform-wide pool (used by the admin
// "spin" action to diversify tag assignment across seeds).
export function dealRandomTags(pool: string[], count = 2): string[] {
  const list = normalizeTags(pool);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.max(1, count));
}
