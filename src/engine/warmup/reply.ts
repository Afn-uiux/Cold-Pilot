// Context-aware warmup replies. The primary generator uses AI so the reply
// genuinely matches the message it answers — a real conversation riffs on the
// topic it was sent, not a canned line. If the AI call fails (timeout, quota),
// fall back to a derived-topic template that echoes a phrase from the original
// message, and only then to a generic acknowledgement.

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const AI_TIMEOUT = 12000;
const AI_MAX_RETRIES = 2;

const GENERIC_REPLIES = [
  "Thanks for reaching out, I'll take a look at this.",
  "Got it, will review and get back to you.",
  "Thanks for the note. I'll follow up shortly.",
  "Appreciate you sending this over. Let me check.",
  "Received, thanks. I'll circle back soon.",
  "Good to hear from you. Let me review this.",
  "Thanks, this looks interesting. I'll review.",
  "Noted, thanks for the update.",
  "Thanks for sharing. I'll take a closer look.",
  "Got your message. Will get back to you shortly.",
];

const TOPIC_TEMPLATES = [
  (t: string) => `Thanks for the update on ${t} — I'll take a closer look.`,
  (t: string) => `Good to hear about ${t}, appreciate you sending it over. Will review.`,
  (t: string) => `Noted on ${t}, thanks for sharing. I'll get back to you shortly.`,
  (t: string) => `Thanks for the note on ${t}. Let me review and circle back.`,
  (t: string) => `Got it — thanks for flagging ${t}, I'll look into this.`,
  (t: string) => `Appreciate the heads up on ${t}, I'll take a look soon.`,
  (t: string) => `Thanks, I've seen the bit about ${t} — will respond properly shortly.`,
];

function cleanPhrase(raw: string): string | null {
  const trimmed = raw.trim().replace(/^re:\s*/i, "").replace(/^fwd?:\s*/i, "").replace(/[.,;:!?]+$/, "");
  if (trimmed.length === 0) return null;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2 || words.length > 9) return null;
  const lower = words.join(" ").toLowerCase();
  if (lower === "warmup" || lower === "quick update" || lower === "hi" || lower === "hello") return null;
  return lower;
}

function fallbackReply(originalSubject: string | null | undefined, originalBodyPreview?: string | null): string {
  const realSubject = originalSubject && !/^warmup$/i.test(originalSubject.trim())
    ? originalSubject
    : null;
  const topic = cleanPhrase(realSubject ?? "") ?? cleanPhrase(originalBodyPreview?.slice(0, 80) ?? "");
  if (!topic) {
    return GENERIC_REPLIES[Math.floor(Math.random() * GENERIC_REPLIES.length)];
  }
  const template = TOPIC_TEMPLATES[Math.floor(Math.random() * TOPIC_TEMPLATES.length)];
  return template(topic);
}

// Best-effort human name for a sender address ("jane.doe@x.com" → "Jane Doe"),
// used so the reply can address the other side naturally.
export function nameFromEmail(email: string): string | null {
  const local = email.split("@")[0] ?? "";
  if (!local) return null;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || null;
}

async function aiReply(
  originalSubject: string | null | undefined,
  originalBodyPreview: string | null | undefined,
  fromName?: string | null,
  toName?: string | null,
): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const who = fromName?.trim() || "a colleague";
  const recipient = toName?.trim() || "the sender";
  const subject = originalSubject?.trim() || "(no subject)";
  const body = originalBodyPreview?.trim() || "(no body preview available)";

  const prompt =
    `Write the reply body to a business email you just received.\n\n` +
    `You are ${who}. The sender is ${recipient}.\n\n` +
    `EMAIL YOU RECEIVED:\n` +
    `Subject: ${subject}\n` +
    `Body: ${body}\n\n` +
    `RULES:\n` +
    `- 1 to 3 short sentences that clearly respond to what was sent — acknowledge the actual topic.\n` +
    `- Match the tone of the original email.\n` +
    `- End with a light follow-up question or a natural close.\n` +
    `- Plain text only. No greeting, no sign-off, no HTML tags, no markdown, no links, no emojis.\n` +
    `- Never use "circle back", "touch base", or "reaching out".\n` +
    `Return ONLY the reply text.`;

  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
      const res = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          max_tokens: 150,
          temperature: 0.9,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (attempt < AI_MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1200));
        continue;
      }

      const data = await res.json();
      const raw: string = data.choices?.[0]?.message?.content || "";
      const cleaned = raw
        .replace(/^["'`\s]+/, "")
        .replace(/["'`\s]+$/, "")
        .trim();
      if (cleaned.length >= 5) return cleaned;
    } catch {
      if (attempt < AI_MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1200));
    }
  }
  return null;
}

// Shared by imap.ts (user mailbox replies to a seed) and seed-engage.ts (seed
// replies back to the sender). Returns an AI-drafted reply matched to the
// original message; degrades to a topic echo, then a canned line, on failure.
export async function buildWarmupReplyBody(
  originalSubject: string | null | undefined,
  originalBodyPreview?: string | null,
  fromName?: string | null,
  toName?: string | null,
): Promise<string> {
  const ai = await aiReply(originalSubject, originalBodyPreview, fromName, toName);
  return ai ?? fallbackReply(originalSubject, originalBodyPreview);
}