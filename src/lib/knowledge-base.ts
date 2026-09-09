// Loads the curated knowledge base markdown files for the AI support chat.
import { readFileSync } from "fs";
import { join } from "path";

const KB_DIR = join(process.cwd(), "knowledge");

// Order matters: files are concatenated in this order for the system prompt.
const KB_FILES = [
  "core.md",
  "plans.md",
  "credits.md",
  "email-accounts.md",
  "warmup.md",
  "campaigns.md",
  "leads.md",
  "signup-verification.md",
];

let cached: string | null = null;

// Strip markdown emphasis before feeding the AI so it never echoes raw
// formatting back at the user. Headings and bullets stay (they give the model
// structure to read), only the decorative symbols are removed.
function sanitizeMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[ \t]*[-*+]\s+/gm, "")
    .replace(/^[ \t]*\d+\.\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Concatenated knowledge base text. Read once per server process and cached —
// the files only change on deploy, so a static cache is correct and avoids
// hitting the filesystem on every chat message.
export function loadKnowledgeBase(): string {
  if (cached) return cached;
  const parts: string[] = [];
  for (const file of KB_FILES) {
    try {
      parts.push(`[${file}] ${sanitizeMarkdown(readFileSync(join(KB_DIR, file), "utf-8"))}`);
    } catch {
      // A missing file just means that topic isn't documented yet.
    }
  }
  cached = parts.join("\n\n");
  return cached;
}