import { NextResponse } from "next/server";
import { trialGuard } from "@/lib/trial";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlan, CREDIT_COSTS } from "@/lib/plans";
import { spendCredits, InsufficientCreditsError } from "@/lib/credits";
import crypto from "crypto";

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

async function callAI(prompt: string): Promise<string> {
  const res = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("Empty response from AI");
  return content;
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
    // refId must be unique per operation for idempotent credit ledgering. A
    // fresh UUID makes every AI generation its own transaction (the old static
    // `action` string like "write"/"spin" collided across calls).
    await spendCredits(session.user.id, CREDIT_COSTS.ai, "ai", `ai:${action}:${crypto.randomUUID()}`);
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
        const result = await callAI(
          `Rewrite the following email text to say the same thing differently while keeping the same tone and structure. Return only the rewritten text:\n\n${text}`
        );
        return NextResponse.json({ result });
      }

      if (action === "check") {
        const result = await callAI(
          `Check the following email text for grammar, spelling, tone, and readability issues. List each issue found, or say "Looks good! No issues found." if nothing is wrong:\n\n${text}`
        );
        return NextResponse.json({ result });
      }

      if (action === "write") {
        const style = context === "followup" ? "follow-up" : context === "reengagement" ? "re-engagement" : "outreach";
        const result = await callAI(
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

        const result = await callAI(
          `You are a cold email outreach expert for ${companyName || "a B2B company"}.\n` +
            `Offer: ${offerDetails || "Describe the product/service being sold."}\n` +
            `Target audience: ${targetAudience || "B2B decision makers."}\n` +
            `Case studies / social proof: ${caseStudies || "None provided."}\n\n` +
            `Write a ${stepCount}-email cold outreach sequence. The first email is the initial outreach; each following email is a follow-up that references the previous one and adds value.\n\n` +
            `STRICT RULES for every email:\n` +
            `- Exactly 3 paragraphs\n` +
            `- Total length: 100 words maximum\n` +
            `- Use simple, plain English â€” no jargon, no corporate buzzwords\n` +
            `- Short sentences, easy to read\n` +
            `- Use {{firstName}} for the recipient's first name and {{company}} for their company name\n\n` +
            `Return ONLY a valid JSON array of exactly ${stepCount} objects. Each object has "subject" (a subject line) and "body" (the email body with \\n line breaks between paragraphs). No markdown, no extra text.`
        );
        const steps = extractJsonArray(result);
        if (steps.length > 0) {
          return NextResponse.json({ steps });
        }
      }
    } catch (e) {
      console.error("AI error, falling back:", (e as Error).message);
    }
  }

  // Fallback: simulated AI when no AI API key is set
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
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "Your Company";
    const offerDetails = typeof body.offerDetails === "string" ? body.offerDetails.trim() : "";
    const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
    const caseStudies = typeof body.caseStudies === "string" ? body.caseStudies.trim() : "";
    const rawCount = Number(body.stepCount);
    const stepCount = Math.min(Math.max(Number.isFinite(rawCount) ? Math.round(rawCount) : 3, 1), 10);

    const offer = offerDetails || "we help businesses grow";
    const audience = targetAudience || "companies like yours";
    const proof = caseStudies || "";

    const subjects = [
      [`Quick question about {{company}}`, `One idea for {{company}}`, `Thoughts on {{company}}`],
      [`Following up`, `Did you see this?`, `Worth a quick look`],
      [`Last note from me`, `Checking in`, `Before I move on`],
      [`One more thing`, `Quick follow-up`, `Still relevant?`],
      [`Circling back`, `Did this help?`, `Any thoughts?`],
    ];

    const greetings = ["Hi {{firstName}},", "Hey {{firstName}},", "Hello {{firstName}},"];
    const signs = ["Best,", "Cheers,", "Regards,", "Thanks,"];

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickIdx = <T,>(arr: T[], i: number): T => arr[i % arr.length];

    const steps: GeneratedStep[] = [];

    for (let i = 0; i < stepCount; i++) {
      const subject = i === 0
        ? truncateSubject(pickIdx(subjects[0], i))
        : truncateSubject(pickIdx(subjects[Math.min(i, subjects.length - 1)], i));

      let body: string;

      if (i === 0) {
        const openers = [
          `I noticed that ${audience} often struggle with the same challenges â€” and I think {{company}} could benefit from a fresh approach.`,
          `I came across {{company}} and wanted to share something relevant.`,
          `I've been looking at {{company}} and had a thought I wanted to share.`,
        ];
        const paragraphs = [
          `${offer}. We've helped businesses like {{company}} see real results â€” ${proof ? proof.split(".")[0] + "." : "and I'd love to show you how."}`,
          `We work with ${audience} every day, and ${offer}. The difference shows quickly.`,
          `${offer}. Our clients typically see improvement within the first month.`,
        ];
        const ctas = [
          "Could we chat about how a similar approach could benefit {{company}}?",
          "Do you have a few minutes to discuss this?",
          "Worth a brief conversation?",
        ];
        body = `${pick(greetings)}\n\n${pick(openers)}\n\n${pick(paragraphs)}\n\n${pick(ctas)}\n\n${pick(signs)}\n{{sendingAccountFirstName}}`;
      } else if (i === stepCount - 1 && stepCount >= 3) {
        const closes = [
          [
            `I don't want to take up more of your time.`,
            `If a fresh approach to ${offer.split(" ").slice(0, 5).join(" ")} is something {{company}} needs, I'm here.`,
            `If not, no worries â€” I'll stop reaching out.`,
          ],
          [
            `Last one from me, I promise.`,
            `We help ${audience} with ${offer}.`,
            `If the timing isn't right, I totally get it.`,
          ],
        ];
        const cb = pick(closes);
        body = `${pick(greetings)}\n\n${cb[0]}\n${cb[1]}\n${cb[2]}\n\n${pick(signs)}\n{{sendingAccountFirstName}}`;
      } else {
        const followups = [
          [
            `Just wanted to check in and see if you had a chance to consider my previous email.`,
            `I truly believe that ${offer.split(" ").slice(0, 6).join(" ")} could make a big difference for {{company}}.`,
            `Do you have a few minutes to discuss this?`,
          ],
          [
            `Circling back on my last email.`,
            `We help ${audience} with ${offer}.`,
            `Would a quick call work for you?`,
          ],
          [
            `Wanted to make sure you saw my last email.`,
            `${offer} â€” and we've done this for ${audience} before.`,
            `Happy to share more details if you're interested.`,
          ],
        ];
        const fb = pick(followups);
        body = `${pick(greetings)}\n\n${fb[0]}\n${fb[1]}\n${fb[2]}\n\n${pick(signs)}\n{{sendingAccountFirstName}}`;
      }

      steps.push({ subject, body });
    }

    return NextResponse.json({ steps });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}