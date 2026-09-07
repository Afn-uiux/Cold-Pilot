import { NextResponse } from "next/server";
import { trialGuard } from "@/lib/trial";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlan, CREDIT_COSTS } from "@/lib/plans";
import { spendCredits, addCredits, InsufficientCreditsError } from "@/lib/credits";
import { rateLimitAsync } from "@/lib/rate-limit";
import crypto from "crypto";

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

export type SpamFinding = {
  flag: string;
  text: string;
  suggestion: string;
  fix: string;
};

// Spam-trigger words/phrases that major filters (Gmail/Outlook/Yahoo) flag.
// Greedy substring match so "free trial!" and "act now" both trip. The AI path
// refines context; this deterministic list is the no-key backstop.
const SPAM_WORD_PATTERNS: { flag: string; pattern: RegExp; suggestion: string }[] = [
  { flag: "free trial/sample/demo", pattern: /free\s+(trial|sample|demo|consultation|gift)/i, suggestion: `"free trial/sample" reads as spam — frame it as a "no-cost pilot" or "complimentary walkthrough".` },
  { flag: '"free"', pattern: /\bfree\b/i, suggestion: '"free" is a top spam trigger — use specific, honest phrasing (e.g. "the pilot is open to a few teams").' },
  { flag: "guarantee/guaranteed", pattern: /guarantee/i, suggestion: '"guarantee" trips filters — say what you can evidence instead of promising.' },
  { flag: "act now/hurry/don't wait", pattern: /act\s+(now|immediately|fast)|hurry|don'?t\s+wait/i, suggestion: 'pressure words like "act now" are spam markers — drop the urgency.' },
  { flag: "limited time/offer", pattern: /limited\s+(time|offer|spots)|expires\s+(soon|today)|only\s+today/i, suggestion: 'scarcity phrases ("limited time") are classic spam markers.' },
  { flag: "100%", pattern: /100%/i, suggestion: '"100%" is a hard spam trigger — use a real number or drop it.' },
  { flag: "no risk/no obligation", pattern: /risk[- ]?free|no\s+risk|no\s+obligation|no\s+strings\s+attached|no\s+cost|no\s+fees/i, suggestion: '"no risk / no obligation" promises are spam classics — remove or rephrase.' },
  { flag: "click here/buy now", pattern: /click\s+here|buy\s+now|order\s+now|subscri?be\s+(today|now)|sign\s+up\s+now/i, suggestion: 'direct action phrases ("click here", "buy now") trigger filters.' },
  { flag: "winner/prize language", pattern: /congratulations|you'?ve\s+(been\s+selected|won)|you\s+are\s+a\s+winner/i, suggestion: 'winner/prize language is a confirmed spam signal — never use it.' },
  { flag: "special offer/best price", pattern: /special\s+offer|special\s+promotion|best\s+price|lowest\s+(price|rate)|discount/i, suggestion: 'deal/promotion language reads as advertising spam in cold email.' },
  { flag: "hyperbole (amazing/incredible)", pattern: /amazing|incredible|unbelievable|miracle/i, suggestion: 'hyperbole ("amazing", "incredible") reads as spam — cut it.' },
  { flag: "money-making phrases", pattern: /\bearn\b|make\s+money|get\s+paid|extra\s+income/i, suggestion: 'money-making phrases are spam classics in cold email.' },
  { flag: "urgent/immediate response", pattern: /urgent|immediate\s+response/i, suggestion: '"urgent"/"immediate response" reads as spam pressure.' },
];

// Mechanical fix for a local match. "" means delete the flagged text (the
// suggestion explains how to reword naturally); everything else swaps the
// flagged text for a safe replacement. ALL-CAPS and exclamations have cheap
// lossless fixes (lowercase / single bang).
function spamFixFor(flag: string, matchText: string): string {
  if (flag === "free trial/sample/demo" || flag === '"free"') {
    return matchText.replace(/\bfree\b/i, "no-cost");
  }
  if (flag === "ALL-CAPS emphasis") return matchText.toLowerCase();
  if (flag === "exclamation marks") return "!";
  return "";
}

function runLocalSpamCheck(emailText: string): SpamFinding[] {
  const findings: SpamFinding[] = [];
  for (const { flag, pattern, suggestion } of SPAM_WORD_PATTERNS) {
    pattern.lastIndex = 0;
    const m = pattern.exec(emailText);
    if (m && m[0]) {
      findings.push({ flag, text: m[0], suggestion, fix: spamFixFor(flag, m[0]) });
    }
  }
  for (const w of emailText.match(/[A-Z]{4,}/g) ?? []) {
    findings.push({
      flag: "ALL-CAPS emphasis",
      text: w,
      suggestion: "shouting in ALL CAPS is a strong spam signal — use normal case.",
      fix: w.toLowerCase(),
    });
  }
  for (const ex of emailText.match(/!{2,}/g) ?? []) {
    findings.push({
      flag: "exclamation marks",
      text: ex,
      suggestion: 'excessive "!!" reads as spam — leave exclamation marks out of cold email.',
      fix: "!",
    });
  }
  return findings;
}

// DeepSeek returns a JSON array of {"text","fix"} fixes. Verify each quoted
// text actually appears in the email (trimmed, case-insensitive) and replace
// it with the email's own verbatim slice so apply-fix always matches exactly.
function extractSpamFindings(raw: string, emailText: string): SpamFinding[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const lower = emailText.toLowerCase();
  const findings: SpamFinding[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const { text: t, fix: f } = item as { text?: unknown; fix?: unknown };
    if (typeof t !== "string" || !t.trim()) continue;
    const idx = lower.indexOf(t.trim().toLowerCase());
    if (idx === -1) continue; // AI quoted something not in the email — skip
    const verbatim = emailText.slice(idx, idx + t.trim().length);
    const fix = typeof f === "string" ? f : "";
    findings.push({
      flag: "AI-flagged phrase",
      text: verbatim,
      suggestion: fix ? `Replace "${verbatim}" with "${fix}".` : "This phrase can hurt inbox placement — remove it or reword it naturally.",
      fix,
    });
  }
  return findings;
}

function spamCheckSummary(findings: SpamFinding[]): string {
  return findings.length
    ? findings.map((f) => `"${f.text}" ─ ${f.suggestion}`).join("\n")
    : "Looks good — no spam-trigger words or phrases found.";
}

// Scan a generated sequence's subjects + bodies for spam-trigger language.
// Returns one finding per unique offending phrase (first step that trips it);
// hits swallowed by a longer match ("Free" inside "Free trial") are dropped.
function scanSequenceForSpam(steps: GeneratedStep[]): SpamFinding[] {
  const findings: SpamFinding[] = [];
  for (const step of steps) {
    const haystack = [step.subject, step.body].filter(Boolean).join("\n");
    for (const f of runLocalSpamCheck(haystack)) {
      const dup = findings.findIndex((x) => x.text.toLowerCase() === f.text.toLowerCase());
      if (dup === -1) findings.push(f);
    }
  }
  return findings
    .sort((a, b) => b.text.length - a.text.length)
    .filter((f, i, arr) => !arr.some((other, j) => j < i && other.text.toLowerCase().includes(f.text.toLowerCase())));
}

// If a generated sequence slipped in spam-trigger language, ask the AI for a
// light rewrite that keeps structure/tone/tags and only swaps the offending
// phrases. On any failure (including a busy AI) keep the original sequence —
// the user still gets working copy, and the prompt-level rules cover the rest.
async function cleanSequenceSpam(steps: GeneratedStep[]): Promise<GeneratedStep[]> {
  const flagged = scanSequenceForSpam(steps);
  if (flagged.length === 0) return steps;
  const summary = flagged.map((f) => `"${f.text}"`).join(", ");
  try {
    const raw = await callAI(
      `A cold outreach sequence contains spam-trigger language (${summary}). ` +
        `Rewrite ONLY the offending phrases so none remain — keep every email's structure, length, tone, and {{tags}} exactly the same. ` +
        `Natural replacements in plain English, no hype words, no exclamation marks, no ALL-CAPS.\n\n` +
        `Return ONLY the exact same JSON array format (one object per email with "subject" and "body"). No markdown, no extra text.\n\n` +
        `SEQUENCE:\n${JSON.stringify(steps)}`
    );
    const cleaned = extractJsonArray(raw);
    return cleaned.length === steps.length ? cleaned : steps;
  } catch {
    return steps;
  }
}

async function callAI(prompt: string): Promise<string> {
  // DeepSeek 429s on bursts (it caps concurrent requests and calls/minute).
  // One polite retry with a short backoff clears most transient throttles; a
  // second consecutive 429 is surfaced as a distinct "rate limited" error so
  // the route can answer honestly and refund the credit.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        const rateError = new Error("DeepSeek rate limit exceeded") as Error & { code?: string };
        rateError.code = "AI_RATE_LIMITED";
        throw rateError;
      }
      throw new Error(`AI API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    if (!content) throw new Error("Empty response from AI");
    return content;
  }
  throw new Error("AI rate limit exceeded");
}

function spintaxCombinations(text: string): number {
  let product = 1;
  const randomRe = /\{\{RANDOM\s*\|\s*([^}]+)\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = randomRe.exec(text)) !== null) {
    product = Math.min(product * m[1].split("|").length, 1e12);
  }
  const reduced = text.replace(/\{\{RANDOM\s*\|\s*([^}]+)\}\}/gi, "");
  let depth = 0;
  let inGroup = false;
  let groupOptions = 0;
  for (const ch of reduced) {
    if (ch === "{") {
      depth++;
      if (depth === 1) {
        inGroup = true;
        groupOptions = 1;
      }
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && inGroup) {
        product = Math.min(product * groupOptions, 1e12);
        inGroup = false;
      }
    } else if (depth === 1 && ch === "|") {
      groupOptions++;
    }
  }
  return product;
}

type GeneratedStep = { subject: string; body: string };

const MAX_SUBJECT = 80;

function truncateSubject(subject: string): string {
  const clean = subject.replace(/\s+/g, " ").trim();
  return clean.length > MAX_SUBJECT ? clean.slice(0, MAX_SUBJECT - 1).trimEnd() + "â€¦" : clean;
}

function extractJsonArray(raw: string): GeneratedStep[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => !!s && typeof s.subject === "string" && typeof s.body === "string")
      .map((s) => ({ subject: truncateSubject(s.subject as string), body: s.body as string }));
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user burst cap, mirroring every other API route. This checks BEFORE
  // any credit is spent, so a blocked request never burns a credit. 10 allows
  // a burst like spin(body+subject) or generate-sequence without punishing
  // normal use, while capping hammering of the shared DeepSeek key.
  const rl = await rateLimitAsync(`ai:${session.user.id}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're generating too quickly. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const plan = getPlan(user?.plan);

  if (!plan.aiEnabled) {
    return NextResponse.json(
      {
        error: "AI writing is included on paid plans. Upgrade to unlock it.",
        code: "PLAN_REQUIRED",
      },
      { status: 402 }
    );
  }

  const body = await req.json();
  const { action, text, context } = body;

  // Validate before charging: an unknown action must not burn credits.
  if (!["spin", "check", "write", "generate-sequence"].includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // refId must be unique per operation for idempotent credit ledgering. A
  // fresh UUID makes every AI generation its own transaction (the old static
  // `action` string like "write"/"spin" collided across calls).
  const spendRefId = `ai:${action}:${crypto.randomUUID()}`;
  try {
    await spendCredits(session.user.id, CREDIT_COSTS.ai, "ai", spendRefId);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Each AI generation costs ${CREDIT_COSTS.ai} credits and you have ${err.balance}. Top up credits or upgrade your plan.`,
          code: "INSUFFICIENT_CREDITS",
          balance: err.balance,
          required: CREDIT_COSTS.ai,
        },
        { status: 402 }
      );
    }
    throw err;
  }

  if (AI_API_KEY) {
    try {
      if (action === "spin") {
        const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
        let leadCount = 0;
        let coverageReq = "";
        let coverageSubjectReq = "";
        if (campaignId) {
          const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, userId: session.user.id },
            select: { id: true },
          });
          if (campaign) {
            leadCount = await prisma.lead.count({ where: { campaignId, deletedAt: null } });
            if (leadCount > 0) {
              const target = Math.max(leadCount, Math.ceil(leadCount * 2));
              coverageReq =
                `\n\nLEAD COVERAGE REQUIREMENT: this email body is sent to ${leadCount} leads. The total number of unique combinations (the product of the option counts across ALL {{RANDOM | ...}} groups in the BODY) MUST be at least ${target}. Add more groups or more options per group until the product is comfortably above ${target}.\n`;
              coverageSubjectReq =
                `\n\nLEAD VARIETY REQUIREMENT: this subject line is sent to ${leadCount} leads. Add {{RANDOM | ...}} groups to as many interchangeable words as possible so subject lines vary widely.\n`;
            }
          }
        }
        const result = await callAI(
          `Convert the cold email below into spintax form. Keep the meaning, tone, and structure identical.\n\n` +
            `RULES:\n` +
            `- Wrap interchangeable words or short phrases in {{RANDOM | option1 | option2 | option3}}: greetings, connectors, adjectives, descriptions, and the call-to-action.\n` +
            `- Every sentence must contain at least one {{RANDOM | ...}} group.\n` +
            `- Every group has at least 2 options, at most 5.\n` +
            `- Always write groups as {{RANDOM | ...}}, never as {a|b|c}.\n` +
            `- Never put tags like {{firstName}}, {{company}}, {{title}}, or email addresses inside a group.\n` +
            `- Use plain newlines (\\n) to separate paragraphs. Never output any HTML tags or <br>.\n` +
            `- CRITICAL: Keep every variable tag ({{firstName}}, {{company}}, {{title}}, etc.) exactly as written, in exactly the same position. Never remove, rename, merge, wrap, or replace variable tags.\n` +
            `- Keep the email roughly the same length.\n` +
            coverageReq +
            `\nReturn ONLY the converted email text. No explanations, no markdown.\n\n` +
            `EMAIL:\n${text}`
        );
        const comboEstimate = spintaxCombinations(result);

        const subjectInput = typeof body.subject === "string" ? body.subject.trim() : "";
        let subject = "";
        let subjectCombo = 0;
        if (subjectInput) {
          subject = (
            await callAI(
              `Convert the email subject line below into spintax form. Keep the meaning, tone, and structure identical.\n\n` +
                `RULES:\n` +
                `- Wrap interchangeable words in {{RANDOM | option1 | option2 | option3}}. A subject is short, so group as many words as possible.\n` +
                `- Every group has at least 2 options, at most 5.\n` +
                `- Always write groups as {{RANDOM | ...}}, never as {a|b|c}.\n` +
                `- Never put tags like {{firstName}}, {{company}}, {{title}}, or email addresses inside a group.\n` +
                `- No HTML tags, no <br>, no newlines.\n` +
                `- CRITICAL: Keep every variable tag ({{firstName}}, {{company}}, {{title}}, etc.) exactly as written, in exactly the same position. Never remove, rename, merge, wrap, or replace variable tags.\n` +
                `- Keep the subject roughly the same length.\n` +
                coverageSubjectReq +
                `\nReturn ONLY the converted subject line. No explanations, no markdown.\n\n` +
                `SUBJECT:\n${subjectInput}`
            )
          ).trim();
          subjectCombo = spintaxCombinations(subject);
        }

        const combined = subjectCombo > 1 ? comboEstimate * subjectCombo : comboEstimate;
        return NextResponse.json({ result, comboEstimate, leadCount, subject, subjectCombo, combined });
      }

      if (action === "check") {
        const result = await callAI(
          `Analyze the following cold email for spam-trigger language that could land it in the spam folder (Gmail/Outlook/Yahoo filters): pressure/scarcity phrases (act now, limited time, urgent, hurry), money/deal promises (guarantee, 100%, no-risk, free trial, discount, best price), winner/prize language, hype words (amazing, incredible, unbelievable, miracle), excessive exclamation marks, and ALL-CAPS emphasis.\n\n` +
            `Return ONLY a JSON array. Each element must be an object: {"text": "the exact phrase as it appears VERBATIM (same case, same spacing) in the email", "fix": "a natural replacement that avoids the spam trigger; use an empty string \\"\\" if the phrase should simply be deleted"}. Match the email's own style and tone. If the email is clean, return []. No markdown, no extra text.\n\nEMAIL:\n${text}`
        );
        const findings = extractSpamFindings(result, text);
        return NextResponse.json({ result: spamCheckSummary(findings), findings });
      }

      if (action === "write") {
        const style = context === "followup" ? "follow-up" : context === "reengagement" ? "re-engagement" : "outreach";
        const result = await callAI(
          `Write a cold email for ${style}. Use {{firstName}} for the recipient's name and {{company}} for their company. Keep it under 150 words, professional but friendly. Avoid spam-trigger words (free, guarantee, 100%, act now, urgent, limited time, winner, prize) and never use ALL-CAPS or exclamation marks. Return only the email body.`
        );
        return NextResponse.json({ result });
      }

      if (action === "generate-sequence") {
        const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
        const offerDetails = typeof body.offerDetails === "string" ? body.offerDetails.trim() : "";
        const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
        const caseStudies = typeof body.caseStudies === "string" ? body.caseStudies.trim() : "";
        const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
        const rawCount = Number(body.stepCount);
        const stepCount = Math.min(Math.max(Number.isFinite(rawCount) ? Math.round(rawCount) : 3, 1), 10);

        let leadContext = "";
        if (campaignId) {
          const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, userId: session.user.id },
            select: { name: true },
          });
          if (campaign) {
            const sampled = await prisma.lead.findMany({
              where: { campaignId, deletedAt: null },
              take: 200,
              select: {
                firstName: true,
                lastName: true,
                company: true,
                title: true,
                website: true,
                location: true,
                personalization: true,
              },
            });
            if (sampled.length > 0) {
              const total = sampled.length;
              const counts: Record<string, number> = {};
              for (const key of ["firstName", "lastName", "company", "title", "website", "location", "personalization"]) counts[key] = 0;
              for (const lead of sampled) {
                for (const key of Object.keys(counts)) {
                  const val = (lead as Record<string, string | null>)[key];
                  if (val && val.trim()) counts[key]++;
                }
              }
              const tagInfo = (["firstName", "lastName", "company", "title", "website", "location", "personalization"] as const).map(key => ({
                tag: key,
                pct: Math.round((counts[key] / total) * 100),
              }));
              const available = tagInfo.filter(t => ["firstName", "lastName", "company"].includes(t.tag) || t.pct >= 25);
              const availableLine = available.length
                ? available.map(t => `{{${t.tag}}} — present on ${t.pct}% of leads`).join("\n")
                : "{{firstName}}, {{company}}";
              const examples = sampled.slice(0, 2).map(l => {
                const parts = [
                  l.firstName, l.lastName, l.title, l.company, l.location, l.website,
                  l.personalization ? l.personalization.slice(0, 120) : null,
                ].filter((v): v is string => !!v);
                return "- " + (parts.join(", ") || "(no personal fields filled in)");
              }).join("\n");
              leadContext =
                `This sequence will be sent to a list of leads. Each {{tag}} you write is replaced automatically, per lead, with that lead's real data.\n\n` +
                `Tags detected from your actual leads (USE ONLY THESE for personalization; never invent other tags):\n${availableLine}\n\n` +
                `Example leads from your list (so you can see what the data looks like):\n${examples}\n\n`;
            }
          }
        }

        const result = await callAI(
          `You are a cold email outreach expert for ${companyName || "a B2B company"}.\n` +
            `Offer: ${offerDetails || "Describe the product/service being sold."}\n` +
            `Target audience: ${targetAudience || "B2B decision makers."}\n` +
            `Case studies / social proof: ${caseStudies || "None provided."}\n\n` +
            leadContext +
            `Write a ${stepCount}-email cold outreach sequence. The first email is the initial outreach; each following email is a follow-up that references the previous one and adds value.\n\n` +
            `STRICT RULES for every email:\n` +
            `- Exactly 3 paragraphs\n` +
            `- Total length: 100 words maximum\n` +
            `- Use simple, plain English — no jargon, no corporate buzzwords\n` +
            `- Short sentences, easy to read\n` +
            `- Use the detected tags ({{firstName}}, {{company}}, etc.) naturally and sparingly. Never build an entire sentence around a single tag — leads missing that field will simply have it removed.\n\n` +
            `- NEVER use spam-trigger words or phrases: free, guaranteed, 100%, act now, limited time, urgent, hurry, winner, cash, prize, discount, best price, click here, no-risk. No ALL-CAPS emphasis and no exclamation marks — those land emails in the spam folder.\n\n` +
            `- ONLY the first email has a subject. Every follow-up email must have an EMPTY subject (""): follow-ups continue the first email's subject thread.\n\n` +
            `Return ONLY a valid JSON array of exactly ${stepCount} objects. Each object has "subject" (a subject line for the first email; "" for follow-ups) and "body" (the email body with \\n line breaks between paragraphs). No markdown, no extra text.`
        );
        const steps = extractJsonArray(result);
        if (steps.length > 0) {
          const cleaned = await cleanSequenceSpam(steps);
          return NextResponse.json({ steps: cleaned });
        }
      }
    } catch (e) {
      // DeepSeek was persistently throttled: be honest instead of silently
      // shipping the canned fallback, and give the credit back — the user
      // bought a real AI generation and didn't get one.
      if ((e as { code?: string })?.code === "AI_RATE_LIMITED") {
        await addCredits(session.user.id, CREDIT_COSTS.ai, "ai_refund", `${spendRefId}:refund`).catch(() => {});
        return NextResponse.json(
          { error: "AI is busy right now. Please try again in a few seconds — your credit was refunded.", code: "AI_RATE_LIMITED" },
          { status: 429 }
        );
      }
      console.error("AI call failed:", (e as Error).message);
    }
  }

  // Fallback: simulated AI when no AI API key is set
  if (action === "spin") {
    const synonyms: Record<string, string[]> = {
      great: ["excellent", "outstanding", "remarkable", "impressive", "exceptional"],
      good: ["solid", "strong", "notable", "quality"],
      impressive: ["striking", "notable", "exceptional", "compelling"],
      amazing: ["incredible", "remarkable", "extraordinary", "stunning"],
      interesting: ["engaging", "intriguing", "captivating", "compelling"],
      opportunity: ["possibility", "potential", "prospect", "chance"],
      help: ["assist", "support", "aid", "contribute"],
      build: ["create", "develop", "establish", "craft"],
      think: ["believe", "consider", "feel", "reckon"],
      quick: ["fast", "rapid", "swift", "brief"],
      Hi: ["Hey", "Hello", "Hi there"],
      "Best,": ["Best,", "Cheers,", "Thanks,"],
    };
    const fallbackSpin = (raw: string): string => {
      const sentences = raw.split(/(?<=[.!?])\s+/);
      return sentences.map((s: string) => {
        const words = s.split(" ");
        if (words.length < 3) return s;
        const idxs = Array.from(new Set(Array.from({ length: words.length }, (_, i) => i).sort(() => Math.random() - 0.5))).slice(0, 2);
        const built = words.slice();
        for (const swapIdx of idxs) {
          const lower = built[swapIdx].toLowerCase().replace(/[^a-zA-Z]/g, "");
          if (!synonyms[lower]) continue;
          const original = built[swapIdx];
          const suffix = /[.,!?]/.test(original) ? original.slice(-1) : "";
          const base = original.replace(/[.,!?]$/, "");
          const options = [base, ...synonyms[lower]];
          built[swapIdx] = `{{RANDOM | ${options.join(" | ")}}}${suffix}`;
        }
        return built.join(" ");
      }).join(" ");
    };
    const result = fallbackSpin(text);
    const subjectInput = typeof body.subject === "string" ? body.subject.trim() : "";
    const subject = subjectInput ? fallbackSpin(subjectInput) : "";
    const comboEstimate = spintaxCombinations(result);
    const subjectCombo = subject ? spintaxCombinations(subject) : 0;
    const combined = subjectCombo > 1 ? comboEstimate * subjectCombo : comboEstimate;
    return NextResponse.json({ result, comboEstimate, subject, subjectCombo, combined });
  }

  if (action === "check") {
    const findings = runLocalSpamCheck(text);
    return NextResponse.json({ result: spamCheckSummary(findings), findings });
  }

  if (action === "write") {
    const prompts: Record<string, string> = {
      outreach: `Hi {{firstName}},\n\nI came across {{company}} and was impressed by your work. I specialize in helping companies like yours with [your service]. Would you be open to a quick chat next week?\n\nBest,\n[Your Name]`,
      followup: `Hi {{firstName}},\n\nJust wanted to follow up on my previous message. I know you're busy, but I'd love to connect if you have a few minutes.\n\nBest,\n[Your Name]`,
      reengagement: `Hi {{firstName}},\n\nI haven't heard back, so I wanted to check in one last time. If the timing isn't right, I completely understand.\n\nBest,\n[Your Name]`,
      default: `Hi {{firstName}},\n\nI wanted to reach out because I believe {{company}} could benefit from what we do. Would you be open to a brief conversation?\n\nBest,\n[Your Name]`,
    };
    return NextResponse.json({ result: prompts[context] || prompts.default });
  }

  if (action === "generate-sequence") {
    // Canned fallback removed (pre-launch): a paid AI generation must never
    // silently ship a prepackaged template. The AI path above either returned
    // real steps, refunded on persistent throttling, or failed for another
    // reason — reaching here means no real steps exist, so refund the credit
    // and tell the user instead of faking it.
    await addCredits(session.user.id, CREDIT_COSTS.ai, "ai_refund", `${spendRefId}:refund`).catch(() => {});
    return NextResponse.json(
      {
        error: "The AI couldn't generate your sequence right now. Please try again in a moment — your credit was refunded.",
        code: "AI_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}