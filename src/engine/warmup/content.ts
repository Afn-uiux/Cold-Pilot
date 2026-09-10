import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const AI_TIMEOUT = 12000;
const AI_MAX_RETRIES = 2;

const AI_PROMPT = `You are writing a short professional email between two business colleagues.
Requirements:
- Subject line: 3 to 7 words, natural, no hype words
- Body: exactly 3 to 4 short sentences (roughly 45 to 60 words), plain text only
- Tone: {tone}
- Context: {context}
- Sender name: {sender_name}
- Invent a small, safe, plausible detail for the situation (a meeting, a schedule, a shared task, some notes) so the email feels real — but never mention specific brands, products, links, prices, currencies, or anything sensitive. Keep it generic and believable.
- Never reuse the exact phrasing of another message you have seen before; vary structure, sentence length, and small details.
- No marketing language, no links, no HTML, no emojis
- Do not start with "I hope this email finds you well"
- Do not use "synergy", "leverage", "circle back", "touch base", "reaching out"
- Must end with a soft question or statement that naturally invites a reply
- Sound like a real human, not a template; when possible rephrase the context in your own words rather than echoing it back
Return ONLY a valid JSON object, no explanation, no markdown:
{"subject": "...", "body": "..."}`;

const TONES = [
  "professional and brief", "friendly and warm", "casual and direct", "polite and concise",
  "conversational and relaxed", "warm and personal", "relaxed and easygoing", "direct and no-nonsense",
  "thoughtful and considerate",
];
const CONTEXTS = [
  "following up on a previous conversation", "checking in after some time has passed",
  "reaching out to reconnect", "checking if the other person had a chance to review something",
  "following up on an email sent last week", "following up after an introduction",
  "confirming a time to catch up", "scheduling or rescheduling a short call",
  "sharing a quick status update on something you both are tracking",
  "asking a small favor such as a quick look at a shared document",
  "arranging to send over some notes or material", "checking in about a deadline or timeline",
  "following up on a plan made in a previous meeting", "confirming details for an upcoming meeting",
  "asking whether a shared task is still on track", "closing the loop on an item that was left open",
  "sharing a brief recap of a discussion", "checking in on something the two of you were going to work on together",
];

// ---------------------------------------------------------------------------
// Combinatorial template pool.
//
// Content is assembled slot-by-slot (greeting x opener x transition x ask x
// signoff, with a varying timeframe and topic), which yields tens of
// thousands of distinct, natural-sounding emails instead of a flat list of
// near-identical check-ins. Every account also gets a deterministic writing
// "voice" (greeting/signoff style, whether it signs its name, how much courteous
// padding it uses, whether it jumps straight in without a greeting) so that
// mailboxes read as distinct people and stay consistent across sends.
// Never brands, money, links, prices — just ordinary work small talk.
// ---------------------------------------------------------------------------

const TOPICS = [
  "the handoff notes", "the schedule for next week", "the plan we outlined",
  "the tracking doc", "the follow-up items from our call", "the draft summary",
  "the timeline we agreed on", "the items we left open", "the updated plan",
  "the notes from Tuesday's meeting", "the list of action points", "the overview for the monthly review",
  "the numbers we went through", "the roadmap we sketched out", "the hand-over file",
  "the agenda for the next meeting", "the project calendar", "the working document",
  "the set of changes we discussed", "the recap from yesterday", "the shared folder",
  "the plan for the coming weeks", "the next version of the document", "the breakdown of tasks",
  "the points from our last sync", "the notes I said I would send", "the matrix we started",
  "the summary of decisions", "the draft outline", "the list of open questions",
];

const TIMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
  "this week", "early next week", "before the end of the week", "sometime next week",
  "later this month", "in the next few days", "midweek", "first thing tomorrow",
  "over the next couple of days", "next week",
];

const GREETING_CASUAL = ["Hey", "Hi", "Hello", "Hey there", "Morning"];
const GREETING_NEUTRAL = ["Hi", "Hello", "Good morning", "Hi there", "Good afternoon"];

const OPENERS = [
  "I had a chance to dig back into {topic} earlier.",
  "I finally got a quiet stretch to go back over {topic}.",
  "I was re-reading the notes from our last call and {topic} came up again.",
  "Quick sanity check on {topic}.",
  "I remembered we were going to loop back on {topic}.",
  "I put some time aside this morning to look at {topic}.",
  "Things have been busy on my end, but I wanted to pick up {topic} again.",
  "I went through {topic} again and a couple of things stood out.",
  "We agreed to revisit {topic}, and I want to make sure it does not slip.",
  "I have been meaning to close the loop on {topic}.",
  "I had another look at {topic} before {time}.",
  "I was planning ahead for {time} and {topic} crossed my mind.",
];

const MID_LINES = [
  "There is one thing I would like to pin down before we move on.",
  "I wanted to run a small question by you first.",
  "Before you review anything, one quick heads-up.",
  "It is probably simplest to settle this over a short call.",
  "I am not looking to reopen the whole thing — just one point.",
  "A few minutes between meetings, so I figured I would write this down now.",
  "I would rather flag it early than leave it for {time}.",
  "No need to answer right away, but it would help me plan ahead.",
  "I just want to be sure we are both working from the same version.",
  "I had a thought about one part of it while going over the notes.",
];

const ASKS = [
  "Does {time} work for a quick call?",
  "Are you free {time} to walk through it?",
  "Cast an eye over {topic} when you get a moment?",
  "Let me know if you have had a chance to look at it yet.",
  "Can you confirm whether we are still good to proceed?",
  "Shall I go ahead and fold in the notes and send the updated version around?",
  "Would you prefer I block out a slot {time}?",
  "Happy to adjust if mornings or afternoons suit you better.",
  "Do you want me to send over the updated copy once I have touched it up?",
  "Just drop me a line whenever suits.",
  "Does {time} suit, or would another day be better?",
];

const COURTESY = [
  "I know it has been a busy stretch, so no pressure on timing at all.",
  "If a quick call is easier than going back and forth, happy to set one up.",
  "This can certainly wait until things settle down on your end.",
  "Happy to move this wherever it is easiest for you.",
  "No rush at all — just wanted to keep it on your radar while it is fresh.",
  "Either way, good to stay connected on it.",
  "I can also pull together any notes you would need to get up to speed.",
  "It can roll over to next week if that suits you better.",
];

const SIGNOFF_CASUAL = ["Cheers", "Thanks", "Talk soon", "Thanks again", "Take care", "Speak soon", "Best"];
const SIGNOFF_NEUTRAL = ["Best", "Regards", "Thanks", "Best regards", "All the best", "Many thanks"];

// Subjects that hang on a topic/timeframe reference.
const SUBJECT_TIMED = [
  "{topic}, {time}", "One question about {topic}", "Confirming {topic}",
  "{topic} — still on track?", "Before {time}: {topic}", "Checking in on {topic} before {time}",
];
// Plain subjects used when no timeframe is referenced.
const SUBJECT_PLAIN = [
  "Quick thing on {topic}", "Following up on {topic}", "One thing to settle",
  "Wanted to loop back", "A few lines", "On {topic}",
];

const SUBJECT_GENERIC = [
  "Quick question for you", "Wanted to check in", "Had a thought about this",
  "One thing I wanted to mention", "Just a quick note", "Checking in with you",
  "Quick update from my end", "Wanted to get your thoughts", "Re: our last conversation",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(p: number): boolean {
  return Math.random() < p;
}

interface Voice {
  greeting: string[];
  signoff: string[];
  useName: boolean;
  extChance: number;
  extraSentence: boolean;
  bare: boolean; // skip greeting entirely
}

// Deterministic per-account writing voice so each mailbox sounds like one
// distinct, consistent person while different mailboxes sound like different
// people.
function accountVoice(mailboxId: string): Voice {
  const h = crypto.createHash("sha256").update(`voice:${mailboxId}`).digest();
  const n1 = h.readUInt16BE(0);
  const n2 = h.readUInt16BE(2);
  return {
    greeting: n1 % 2 === 0 ? GREETING_CASUAL : GREETING_NEUTRAL,
    signoff: n2 % 2 === 0 ? SIGNOFF_CASUAL : SIGNOFF_NEUTRAL,
    useName: n1 % 10 < 7,
    extChance: [0.3, 0.55, 0.85][n2 % 3],
    extraSentence: n2 % 10 < 6,
    bare: n1 % 100 < 12,
  };
}

function buildTemplateContent(mailboxId: string, senderName: string): { subject: string; body: string } {
  const voice = accountVoice(mailboxId);
  const topic = pick(TOPICS);
  const time = pick(TIMES);
  const withTime = chance(0.7);

  const greet = voice.bare ? "" : pick(voice.greeting) + (chance(0.6) && !voice.bare ? ` ${senderName},` : ",");
  const opener = withTime ? pick(OPENERS) : pick(OPENERS.filter(o => !o.includes("{time}")));
  const mid = voice.extraSentence ? pick(MID_LINES) : "";
  const ask = withTime ? pick(ASKS) : pick(ASKS.filter(a => !a.includes("{time}")));
  const courtesy = chance(voice.extChance) ? pick(COURTESY) : "";
  const signoff = voice.useName ? `${pick(voice.signoff)},\n${senderName}` : pick(voice.signoff);

  let subject: string;
  if (withTime && chance(0.6)) {
    subject = pick(SUBJECT_TIMED).replace("{topic}", topic).replace("{time}", time);
  } else if (chance(0.2)) {
    subject = pick(SUBJECT_GENERIC);
  } else {
    subject = pick(SUBJECT_PLAIN).replace("{topic}", topic);
  }

  const sentence = (s: string) => (s ? " " + s.replace("{topic}", topic).replace("{time}", time) : "");
  const body = `${greet}${sentence(opener)}${sentence(mid)}${sentence(courtesy)}${sentence(ask)}\n\n${signoff}`;

  return { subject, body };
}

function hashContent(subject: string, body: string): string {
  return crypto.createHash("sha256").update(`${subject.toLowerCase().trim()}|||${body.toLowerCase().trim()}`).digest("hex");
}

export async function isDuplicate(
  senderMailboxId: string,
  receiver: { seedMailboxId: string | null; seedInboxId: string | null },
  subject: string,
  body: string,
): Promise<boolean> {
  const contentHash = hashContent(subject, body);
  // Never reuse copy this sender has already sent anywhere, and never send
  // copy any other account has already used into this receiver's inbox — that
  // keeps messages distinct both per-mailbox and per-recipient.
  const [bySender, byReceiver] = await Promise.all([
    prisma.warmupContent.findFirst({
      where: { senderMailboxId, contentHash },
    }),
    prisma.warmupContent.findFirst({
      where: {
        contentHash,
        OR: [
          ...(receiver.seedMailboxId ? [{ seedMailboxId: receiver.seedMailboxId }] : []),
          ...(receiver.seedInboxId ? [{ seedInboxId: receiver.seedInboxId }] : []),
        ],
      },
    }),
  ]);
  return bySender !== null || byReceiver !== null;
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
  // Combinatorial pool — effectively huge, so exhaustion-based reset is a
  // safety net only (brings it to true when an account hits tens of thousands).
  const poolSize = (TOPICS.length + TIMES.length) * (OPENERS.length + MID_LINES.length + ASKS.length + COURTESY.length) * 8;
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
          temperature: 1.0,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (attempt < AI_MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1500));
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
      if (attempt < AI_MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1500));
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
    const content = buildTemplateContent(senderMailboxId, senderName);
    const duplicate = await isDuplicate(senderMailboxId, receiver, content.subject, content.body);
    if (!duplicate) {
      await recordUsedContent(senderMailboxId, receiver, content.subject, content.body, "templates");
      return { ...content, source: "templates" };
    }
  }

  await resetUsedContent(senderMailboxId);
  const content = buildTemplateContent(senderMailboxId, senderName);
  await recordUsedContent(senderMailboxId, receiver, content.subject, content.body, "templates");
  return { ...content, source: "templates" };
}