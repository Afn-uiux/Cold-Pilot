import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const AI_TIMEOUT = 15000;
const AI_MAX_RETRIES = 3;

const AI_PROMPT = `You are writing a short professional email between two business colleagues.
Requirements:
- Subject line: 3 to 7 words, natural, no hype words
- Body: exactly 2 to 3 sentences, plain text only
- Tone: {tone}
- Context: {context}
- Sender name: {sender_name}
- No marketing language, no links, no HTML, no emojis
- Do not start with "I hope this email finds you well"
- Do not use "synergy", "leverage", "circle back", "touch base", "reaching out"
- Must end with a soft question or statement that naturally invites a reply
- Sound like a real human, not a template
Return ONLY a valid JSON object, no explanation, no markdown:
{"subject": "...", "body": "..."}`;

const TONES = ["professional and brief", "friendly and warm", "casual and direct", "polite and concise", "conversational and relaxed"];
const CONTEXTS = [
  "following up on a previous conversation", "checking in after some time has passed",
  "reaching out to reconnect", "touching base on something discussed before",
  "following up on an email sent last week", "checking if the other person had a chance to review something",
  "reaching out as it has been a while", "following up after an introduction",
];

const SUBJECTS = [
  "Quick question for you", "Following up on this", "Wanted to check in",
  "Re: our earlier exchange", "Had a thought about this", "One thing I wanted to mention",
  "Did you get a chance to look at this", "Circling back on this", "Touching base",
  "Just a quick note", "Checking in with you", "Thought you might find this useful",
  "Following up from last week", "Re: our last conversation", "Quick update from my end",
  "Something I wanted to share", "Wanted to get your thoughts", "Reaching out about this",
  "A few things I wanted to cover", "Any update on your end", "Hope things are going well",
  "Following up as promised", "Checking on the status of this", "Re: the discussion we had",
  "Wanted to reconnect", "A quick heads up", "Just checking in", "Wanted to loop you in",
  "Re: what we talked about", "Following up on my last message", "Wanted to touch base quickly",
  "Re: moving forward on this", "One quick thing", "Keeping you in the loop",
  "Wanted to get your input", "Re: the item we discussed", "Just a brief follow-up",
  "Checking in on this", "Wanted to share a quick update", "Re: next steps",
  "Had a chance to review this", "Following up before end of week", "Something worth discussing",
  "Wanted to make sure we are aligned", "Reconnecting on this", "Re: where we left off",
  "Quick check-in", "Wanted to bring this to your attention", "Following up once more",
  "Re: our ongoing discussion", "Thought I would reach out", "Wanted to confirm a few things",
  "Any thoughts on this", "Re: the plan we outlined", "Quick follow-up from my side",
  "Wanted to revisit this with you", "Checking back in with you", "Re: picking up from last time",
  "One more thing before we proceed", "Wanted to keep the conversation going",
];

const BODIES: string[] = [
  "Hi {name}, just wanted to touch base this week. Do you have a few minutes to connect? {signoff}",
  "{greeting}, hope things are going well on your end. I had a quick thought I wanted to run by you when you get a chance. {signoff}, {name}",
  "{greeting} {name}, wanted to follow up on something we discussed earlier. Would love to hear your thoughts. {signoff}",
  "Hi there, just checking in to see how things are progressing on your end. Let me know if you need anything from me. {signoff}, {name}",
  "{greeting}, I wanted to reach out and see if now is a good time to reconnect. {signoff}",
  "Hi {name}, hope your week is going smoothly. I had a quick question I wanted to ask when you have a moment. {signoff}",
  "{greeting} {name}, just a quick follow-up from our last conversation. Do you have any updates to share? {signoff}",
  "Hi, wanted to check in and see where things stand. Let me know if there is anything I can do to help move this forward. {signoff}, {name}",
  "{greeting} {name}, I was thinking about what we discussed and wanted to share a quick thought. Would be curious to hear your take. {signoff}",
  "Hi there, hope everything is going well. Just reaching out to see if you had a chance to look into this. {signoff}, {name}",
  "{greeting}, just a brief note to follow up. Let me know when you have a moment to chat. {signoff}",
  "Hi {name}, circling back on this one. Any updates from your side? {signoff}",
  "{greeting} {name}, wanted to make sure this did not fall through the cracks. Let me know if you need anything. {signoff}",
  "Hi, just checking in quickly. Would be great to reconnect this week if your schedule allows. {signoff}, {name}",
  "{greeting}, wanted to keep the conversation going from where we left off. Any thoughts on moving forward? {signoff}",
  "Hi {name}, hope things are good on your end. I had something I wanted to discuss when you get a free moment. {signoff}",
  "{greeting} {name}, just a quick note to follow up. Let me know your thoughts when you get a chance. {signoff}",
  "Hi, wanted to reach out and touch base. Do you have a few minutes sometime this week? {signoff}, {name}",
  "{greeting}, following up as I wanted to make sure we are on the same page. Let me know if you have any questions. {signoff}",
  "Hi {name}, just checking in to see if there are any updates. Feel free to let me know when you are ready to move forward. {signoff}",
  "{greeting} {name}, wanted to share a quick update from my end. Let me know if this changes anything on your side. {signoff}",
  "Hi there, hope the week is going well. Just a brief follow-up to see if you had any thoughts on this. {signoff}, {name}",
  "{greeting}, I wanted to reconnect and see how things are progressing. Do you have a moment to talk this week? {signoff}",
  "Hi {name}, just touching base to make sure nothing got lost in the shuffle. Let me know if you need anything from me. {signoff}",
  "{greeting} {name}, hope you are having a good week. Any chance you had time to look at what I sent over? {signoff}",
  "Hi, following up from my earlier message. Would love to get your input when you have a free moment. {signoff}, {name}",
  "{greeting}, just a quick check-in. Let me know if there is anything I can do to help with this. {signoff}",
  "Hi {name}, wanted to see if you had a chance to review the details. Happy to answer any questions you might have. {signoff}",
  "{greeting} {name}, reaching out to reconnect. Hope things have been going well since we last spoke. {signoff}",
  "Hi there, just wanted to send a quick note to follow up. Let me know your thoughts when you get a moment. {signoff}, {name}",
  "{greeting}, I wanted to check in and see if you are still planning to move forward with this. Just let me know. {signoff}",
  "Hi {name}, hope your week is off to a good start. I had a quick question I wanted to run by you. {signoff}",
  "{greeting} {name}, wanted to reach out and keep things moving on our end. Any updates from you? {signoff}",
  "Hi, just following up on this. Let me know when you have a moment to connect. {signoff}, {name}",
  "{greeting}, wanted to make sure I had not missed anything. Let me know if there are any next steps I should be aware of. {signoff}",
  "Hi {name}, hope all is well. Just a quick note to check in and see how things are going on your side. {signoff}",
  "{greeting} {name}, wanted to circle back and see if you had any further thoughts on this. {signoff}",
  "Hi there, checking in quickly. Would love to reconnect and compare notes when you have a chance. {signoff}, {name}",
  "{greeting}, just reaching out to follow up on our last exchange. Let me know if anything has changed. {signoff}",
  "Hi {name}, wanted to get back to you on this. Do you have time for a quick conversation this week? {signoff}",
  "{greeting} {name}, hope things are going smoothly. Just wanted to check in and see if there are any updates. {signoff}",
  "Hi, just a brief note to follow up. Let me know if this is still on your radar. {signoff}, {name}",
  "{greeting}, wanted to reconnect and see where things stand. Looking forward to hearing from you. {signoff}",
  "Hi {name}, just checking in to see if there is anything I can help with. Happy to jump on a call if needed. {signoff}",
  "{greeting} {name}, hope the week has been good so far. Wanted to touch base and see how everything is going. {signoff}",
  "Hi there, just following up to make sure we are still aligned. Let me know if anything has changed on your end. {signoff}, {name}",
  "{greeting}, wanted to send a quick note to keep in touch. Let me know if there is anything I should know about. {signoff}",
  "Hi {name}, just a quick follow-up from our earlier conversation. Any progress to report from your side? {signoff}",
  "{greeting} {name}, hope things are going well. Just reaching out to touch base and stay connected. {signoff}",
  "Hi, following up on this one more time. Let me know your thoughts whenever you get a chance. {signoff}, {name}",
  "{greeting}, checking in to see if there is anything I missed. Happy to help if you need anything. {signoff}",
  "Hi {name}, just wanted to send a brief note and reconnect. Let me know if now is a good time to catch up. {signoff}",
  "{greeting} {name}, reaching out to follow up on something from last week. Do you have a moment to chat? {signoff}",
  "Hi there, hope your week is going well. Just checking in and wanted to see if you had any updates. {signoff}, {name}",
  "{greeting}, I wanted to keep this moving and see if there is anything new on your side. Let me know. {signoff}",
  "Hi {name}, just a quick check-in to see how things are progressing. Feel free to reach out whenever you are ready. {signoff}",
  "{greeting} {name}, wanted to follow up and make sure everything is on track. Let me know if there are any issues. {signoff}",
  "Hi, just sending a quick note to stay in touch. Hope things are going well on your end. {signoff}, {name}",
  "{greeting}, wanted to touch base before the end of the week. Let me know if anything needs my attention. {signoff}",
  "Hi {name}, hope your week is wrapping up well. Just following up to make sure nothing was missed. {signoff}",
  "{greeting} {name}, just a quick follow-up. Wanted to check in and see if there is anything I can help with. {signoff}",
  "Hi there, reaching out to reconnect and see how things are going. Let me know if you have a moment to chat. {signoff}, {name}",
  "{greeting} {name}, hope this week has been treating you well. Just wanted to send a quick note and stay connected. Let me know if you have any updates. {signoff}",
  "Hi, wanted to check in one more time before the week is out. Always good to stay in touch. Let me know when you have a moment. {signoff}, {name}",
  "Hi {name}, wanted to circle back one more time. Any news to share from your side? {signoff}",
  "{greeting}, just checking in to see if you have had a chance to review this yet. No rush, just want to stay in the loop. {signoff}",
  "Hi {name}, hope things are moving along well. Just wanted to send a quick note and check in. {signoff}",
  "{greeting} {name}, touching base again to see if there are any updates. Let me know when you are free to connect. {signoff}",
  "Hi there, following up on my previous message. Happy to answer any questions or provide more context if helpful. {signoff}, {name}",
  "{greeting}, wanted to reach out and see if there is anything from my side that can help move this forward. {signoff}",
  "Hi {name}, just a brief follow-up to see how things are going. Let me know if you need anything at all. {signoff}",
  "{greeting} {name}, hope the week has been productive. Just checking in and wanted to stay connected. {signoff}",
  "Hi, following up here to see if there are any new developments. Looking forward to hearing back from you. {signoff}, {name}",
  "{greeting}, just reaching out to touch base. Let me know if there is anything worth discussing when you have a moment. {signoff}",
  "Hi {name}, wanted to reconnect and check in on this. Please do not hesitate to reach out if you need anything. {signoff}",
  "{greeting} {name}, hope everything is going smoothly. Just a quick follow-up to stay in the loop. {signoff}",
  "Hi there, just a brief check-in. Let me know when it is a good time to catch up. {signoff}, {name}",
  "{greeting}, wanted to keep the lines of communication open. Let me know if there is anything on your end I should be aware of. {signoff}",
  "Hi {name}, following up once more. Looking forward to reconnecting when you have a free moment. {signoff}",
  "{greeting} {name}, just checking in to see if there is anything I can do from my side. Let me know. {signoff}",
  "Hi, hope things are well on your end. Just reaching out to touch base and follow up on this. {signoff}, {name}",
  "{greeting}, wanted to send a quick note to check in. Let me know how things are progressing from your perspective. {signoff}",
  "Hi {name}, following up with a quick note. Would love to reconnect when the timing works for you. {signoff}",
  "{greeting} {name}, just checking in. Let me know if there are any updates I should know about. {signoff}",
  "Hi there, hope everything is going well. Just a brief follow-up to stay on your radar. {signoff}, {name}",
  "{greeting}, wanted to reach out and see if you had a chance to think this over. Happy to jump on a call. {signoff}",
  "Hi {name}, just a quick check-in from my side. Let me know when you have a moment to connect. {signoff}",
  "{greeting} {name}, wanted to follow up one more time. Please let me know if there is anything I can help with. {signoff}",
  "Hi, following up briefly. Looking forward to hearing from you when you have a chance. {signoff}, {name}",
  "{greeting}, just touching base to make sure we are still on track. Let me know if anything comes up. {signoff}",
  "Hi {name}, hope your week is going well. Wanted to check in and see if there are any updates from your side. {signoff}",
  "{greeting} {name}, just a quick note to follow up. Let me know your availability for a brief conversation. {signoff}",
  "Hi there, just checking in one more time. Happy to connect whenever the timing works for you. {signoff}, {name}",
  "{greeting}, wanted to reach out and keep this on your radar. Let me know if you have any thoughts. {signoff}",
  "Hi {name}, just following up to see if there is anything I should know about. Feel free to respond when you have a moment. {signoff}",
  "{greeting} {name}, hope things have been going well. Wanted to touch base and stay in the loop. {signoff}",
  "Hi, circling back on this. Let me know whenever you are ready to move things forward. {signoff}, {name}",
  "{greeting}, reaching out with a quick follow-up. Let me know if this is still on your radar. {signoff}",
  "Hi {name}, wanted to send a final note to check in. Looking forward to reconnecting with you soon. {signoff}",
  "{greeting} {name}, just a quick follow-up. Would love to hear your thoughts when you have a moment. {signoff}",
];

const GREETINGS = ["Hi", "Hey", "Hello", "Good morning", "Morning", "Hi there"];
const SIGNOFFS = ["Best", "Thanks", "Regards", "Cheers", "Talk soon", "Thanks again"];

function hashContent(subject: string, body: string): string {
  return crypto.createHash("sha256").update(`${subject.toLowerCase().trim()}|||${body.toLowerCase().trim()}`).digest("hex");
}

function buildTemplateContent(senderName: string): { subject: string; body: string } {
  const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
  const bodyTemplate = BODIES[Math.floor(Math.random() * BODIES.length)];
  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  const signoff = SIGNOFFS[Math.floor(Math.random() * SIGNOFFS.length)];
  const body = bodyTemplate
    .replace(/\{name\}/g, senderName)
    .replace(/\{greeting\}/g, greeting)
    .replace(/\{signoff\}/g, signoff);
  return { subject, body };
}

export async function isDuplicate(
  senderMailboxId: string,
  receiver: { seedMailboxId: string | null; seedInboxId: string | null },
  subject: string,
  body: string,
): Promise<boolean> {
  const contentHash = hashContent(subject, body);
  const existing = await prisma.warmupContent.findFirst({
    where: {
      senderMailboxId,
      contentHash,
      OR: [
        ...(receiver.seedMailboxId ? [{ seedMailboxId: receiver.seedMailboxId }] : []),
        ...(receiver.seedInboxId ? [{ seedInboxId: receiver.seedInboxId }] : []),
      ],
    },
  });
  return existing !== null;
}

export async function recordUsedContent(
  senderMailboxId: string,
  receiver: { seedMailboxId: string | null; seedInboxId: string | null },
  subject: string,
  body: string,
  source: string,
): Promise<void> {
  const contentHash = hashContent(subject, body);
  try {
    await prisma.warmupContent.create({
      data: {
        senderMailboxId,
        seedMailboxId: receiver.seedMailboxId,
        seedInboxId: receiver.seedInboxId,
        contentHash,
        subjectPreview: subject.slice(0, 60),
        bodyPreview: body.slice(0, 100),
        contentSource: source,
      },
    });
  } catch {
    // Unique constraint — already recorded
  }
}

async function getExhaustionStats(senderMailboxId: string): Promise<{ poolExhaustionPercent: number; totalUsed: number }> {
  const totalUsed = await prisma.warmupContent.count({
    where: { senderMailboxId },
  });
  const poolSize = SUBJECTS.length * BODIES.length;
  const exhaustionPercent = poolSize > 0 ? Math.min(100, (totalUsed / poolSize) * 100) : 0;
  return { poolExhaustionPercent: exhaustionPercent, totalUsed };
}

async function resetUsedContent(senderMailboxId: string): Promise<void> {
  await prisma.warmupContent.deleteMany({
    where: { senderMailboxId },
  });
}

async function generateViaAI(senderName: string, apiKey: string): Promise<{ subject: string; body: string } | null> {
  const tone = TONES[Math.floor(Math.random() * TONES.length)];
  const context = CONTEXTS[Math.floor(Math.random() * CONTEXTS.length)];
  const prompt = AI_PROMPT.replace("{tone}", tone).replace("{context}", context).replace("{sender_name}", senderName);

  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

      const res = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          max_tokens: 200,
          temperature: 0.95,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (attempt < AI_MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      let cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.subject && parsed.body) {
        return { subject: String(parsed.subject).trim(), body: String(parsed.body).trim() };
      }
    } catch {
      if (attempt < AI_MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

export async function generateWarmupContent(
  senderMailboxId: string,
  senderName: string,
  receiver: { seedMailboxId: string | null; seedInboxId: string | null },
): Promise<{ subject: string; body: string; source: string }> {
  const mailbox = await prisma.emailAccount.findUnique({
    where: { id: senderMailboxId },
    select: { warmupAiEnabled: true },
  });

  // Try AI first if enabled
  if (mailbox?.warmupAiEnabled) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey) {
      const aiContent = await generateViaAI(senderName, apiKey);
      if (aiContent) {
        const duplicate = await isDuplicate(senderMailboxId, receiver, aiContent.subject, aiContent.body);
        if (!duplicate) {
          await recordUsedContent(senderMailboxId, receiver, aiContent.subject, aiContent.body, "ai");
          return { ...aiContent, source: "ai" };
        }
      }
    }
  }

  // Fall back to templates
  const { poolExhaustionPercent } = await getExhaustionStats(senderMailboxId);
  if (poolExhaustionPercent >= 80) {
    await resetUsedContent(senderMailboxId);
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const content = buildTemplateContent(senderName);
    const duplicate = await isDuplicate(senderMailboxId, receiver, content.subject, content.body);
    if (!duplicate) {
      await recordUsedContent(senderMailboxId, receiver, content.subject, content.body, "templates");
      return { ...content, source: "templates" };
    }
  }

  await resetUsedContent(senderMailboxId);
  const content = buildTemplateContent(senderName);
  await recordUsedContent(senderMailboxId, receiver, content.subject, content.body, "templates");
  return { ...content, source: "templates" };
}


