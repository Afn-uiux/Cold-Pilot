import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  const { action, text, context } = await req.json();

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
    } catch (e: any) {
      console.error("DeepSeek error, falling back:", e.message);
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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
