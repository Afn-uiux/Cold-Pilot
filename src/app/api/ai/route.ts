import { NextResponse } from "next/server";
import { trialGuard } from "@/lib/trial";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlan, CREDIT_COSTS } from "@/lib/plans";
import { spendCredits, InsufficientCreditsError } from "@/lib/credits";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

async function callDeepSeek(prompt: string): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

type GeneratedStep = { subject: string; body: string };

const MAX_SUBJECT = 80;

function truncateSubject(subject: string): string {
  const clean = subject.replace(/\s+/g, " ").trim();
  return clean.length > MAX_SUBJECT ? clean.slice(0, MAX_SUBJECT - 1).trimEnd() + "…" : clean;
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

  try {
    await spendCredits(session.user.id, CREDIT_COSTS.ai, "ai", action);
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

  if (DEEPSEEK_API_KEY) {
    try {
      if (action === "spin") {
        const result = await callDeepSeek(
          `Rewrite the following email text to say the same thing differently while keeping the same tone and structure. Return only the rewritten text:\n\n${text}`
        );
        return NextResponse.json({ result });
      }

      if (action === "check") {
        const result = await callDeepSeek(
          `Check the following email text for grammar, spelling, tone, and readability issues. List each issue found, or say "Looks good! No issues found." if nothing is wrong:\n\n${text}`
        );
        return NextResponse.json({ result });
      }

      if (action === "write") {
        const style = context === "followup" ? "follow-up" : context === "reengagement" ? "re-engagement" : "outreach";
        const result = await callDeepSeek(
          `Write a cold email for ${style}. Use {{firstName}} for the recipient's name and {{company}} for their company. Keep it under 150 words, professional but friendly. Return only the email body.`
        );
        return NextResponse.json({ result });
      }

      if (action === "generate-sequence") {
        const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
        const offerDetails = typeof body.offerDetails === "string" ? body.offerDetails.trim() : "";
        const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
        const caseStudies = typeof body.caseStudies === "string" ? body.caseStudies.trim() : "";
        const rawCount = Number(body.stepCount);
        const stepCount = Math.min(Math.max(Number.isFinite(rawCount) ? Math.round(rawCount) : 3, 1), 10);

        const result = await callDeepSeek(
          `You are a cold email outreach expert for ${companyName || "a B2B company"}.\n` +
            `Offer: ${offerDetails || "Describe the product/service being sold."}\n` +
            `Target audience: ${targetAudience || "B2B decision makers."}\n` +
            `Case studies / social proof: ${caseStudies || "None provided."}\n\n` +
            `Write a ${stepCount}-email cold outreach sequence. The first email is the initial outreach; each following email is a follow-up that references the previous one and adds value.\n` +
            `Use {{firstName}} for the recipient's first name and {{company}} for their company name.\n` +
            `Keep every email under 150 words, professional but friendly, personalized, and specific to the offer and audience above.\n` +
            `Return ONLY a valid JSON array of exactly ${stepCount} objects. Each object has "subject" (a subject line) and "body" (the email body with \\n line breaks). No markdown, no extra text.`
        );
        const steps = extractJsonArray(result);
        if (steps.length > 0) {
          return NextResponse.json({ steps });
        }
      }
    } catch (e) {
      console.error("DeepSeek error, falling back:", (e as Error).message);
    }
  }

  // Fallback: simulated AI when no DeepSeek key is set
  if (action === "spin") {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const spun = sentences.map((s: string) => {
      const words = s.split(" ");
      if (words.length < 3) return s;
      const swapIdx = Math.floor(Math.random() * words.length);
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
      };
      const word = words[swapIdx].toLowerCase().replace(/[^a-zA-Z]/g, "");
      if (synonyms[word]) {
        const replacement = synonyms[word][Math.floor(Math.random() * synonyms[word].length)];
        words[swapIdx] = words[swapIdx].replace(new RegExp(word, "i"), replacement);
      }
      return words.join(" ");
    });
    return NextResponse.json({ result: spun.join(" ") });
  }

  if (action === "check") {
    const checks: string[] = [];
    const commonErrors: Record<string, string> = {
      "youre": "you're", "its ": "it's ", "dont": "don't", "cant": "can't",
      "wont": "won't", "didnt": "didn't", "wouldnt": "wouldn't", "couldnt": "couldn't",
      "shouldnt": "shouldn't", "ive": "I've", "im": "I'm", "thats": "that's",
      "whats": "what's", "theres": "there's", "theyre": "they're", "wasnt": "wasn't",
    };
    for (const [wrong, right] of Object.entries(commonErrors)) {
      const regex = new RegExp(`\\b${wrong}\\b`, "gi");
      if (regex.test(text)) checks.push(`"${wrong}" should be "${right}"`);
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 10) checks.push("Email body is very short. Consider adding more detail.");
    if (wordCount > 500) checks.push("Email body is quite long. Consider trimming.");
    if (text.includes("  ")) checks.push("Remove double spaces.");
    if (!/[.!?]/.test(text)) checks.push("Consider adding punctuation for readability.");
    return NextResponse.json({ result: checks.length > 0 ? checks.join("\n") : "Looks good! No issues found." });
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
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    const offerDetails = typeof body.offerDetails === "string" ? body.offerDetails.trim() : "";
    const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
    const caseStudies = typeof body.caseStudies === "string" ? body.caseStudies.trim() : "";
    const rawCount = Number(body.stepCount);
    const stepCount = Math.min(Math.max(Number.isFinite(rawCount) ? Math.round(rawCount) : 3, 1), 10);
    const steps: GeneratedStep[] = [];
    for (let i = 0; i < stepCount; i++) {
      const re = i > 0 ? "Re: " : "";
      const subject = truncateSubject(`${re}${companyName || "Outreach"} — quick question about {{company}}`);
      const bodyText =
        i === 0
          ? `Hi {{firstName}},\n\nI'm with ${companyName || "[Your Company]"}. ${offerDetails || "We help companies like yours grow."}\n\nTargeting ${targetAudience || "B2B decision makers"}, we've seen strong results — ${caseStudies || "here's how we can help."}\n\nWould you be open to a quick chat next week?\n\nBest,\n[Your Name]`
          : `Hi {{firstName}},\n\nFollowing up on my last email. ${offerDetails || "We help companies like yours grow."} ${caseStudies || "Happy to share relevant examples."}\n\nIs this something worth a quick conversation?\n\nBest,\n[Your Name]`;
      steps.push({ subject, body: bodyText });
    }
    return NextResponse.json({ steps });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}