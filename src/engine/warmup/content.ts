import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { spinSubjectTag } from "@/lib/seed-tags";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const AI_TIMEOUT = 12000;
const AI_MAX_RETRIES = 2;

const AI_PROMPT = `You are writing a short professional email from {sender_name} to {recipient_name}, two business colleagues.

Recipient name: {recipient_name}
Greeting style (use ONE of these): {greeting_options}
Sign-off style (use ONE of these): {signoff_options}
Include sender's first name in the sign-off: {use_name}
Tone: {tone}

Pick a topic from this list — rotate across ALL categories each time, never repeat a topic you have used before:
{topics}

Recently used topics/subjects from this sender (DO NOT reuse these or similar phrasing — pick a different niche and angle):
{recent_subjects}

Requirements:
- Subject: 3 to 7 natural words; often echo the topic; never buzzwords/hype.
- Body: exactly 3 to 4 short sentences (~45-60 words). Once in a while (~1 in 12) write just a one or two line quick reply instead — real inboxes have both lengths.
- {opening_instruction}
- Invent a small, safe, plausible detail so it feels real — never brands, products, links, prices, currencies, money amounts, or anything sensitive. Keep generic and believable.
- Fundraising/startup chat: casual personal check-in ONLY (how's it going, congrats, deck/pitch). NEVER mention raising money, asking for investor intros, dollar amounts, wire/terms, or selling something. Same for gig/client talk: no soliciting work.
- Never reuse exact phrasing from an earlier message; vary structure, sentence length, details each time.
- No marketing language, no links, no HTML, no emojis.
- Never start with "I hope this email finds you well".
- Never use "synergy", "leverage", "circle back", "touch base", "reaching out".
- Must end with something that invites a natural reply (a soft question usually).
- Sound like a real human, not a template.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

const TONES = [
  "professional and brief", "friendly and warm", "casual and direct", "polite and concise",
  "conversational and relaxed", "warm and personal", "relaxed and easygoing", "direct and no-nonsense",
  "thoughtful and considerate",
];

// ---------------------------------------------------------------------------
// Categorized template pool.
//
// Content is assembled from a situation (topic + opener + ask) drawn from a
// CATEGORY picked at random — never sequentially, so no pattern-cycling. Mixing
// in the occasional short quick-logistics note keeps real-inbox variety: real
// mailboxes contain both medium-length topic emails and one-line replies, and
// an engine that only ever sent the former would itself be a tell.
//
// Every account has a deterministic writing "voice" (greeting/signoff style,
// name use, courteous padding, bare openers) so mailboxes read as distinct,
// consistent people. Never brands, money, links, prices — just believable
// small talk. Fundraising is deliberately kept at casual personal check-in
// level ("how's the raise going", "congrats on closing") — never solicitation,
// never dollar amounts, wire/payment details, or deal terms.
// ---------------------------------------------------------------------------

const TIMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
  "this week", "early next week", "before the end of the week", "sometime next week",
  "later this month", "in the next few days", "midweek", "first thing tomorrow",
  "over the next couple of days", "next week",
];

const GREETING_CASUAL = ["Hey", "Hi", "Hello", "Hey there", "Morning"];
const GREETING_NEUTRAL = ["Hi", "Hello", "Good morning", "Hi there", "Good afternoon"];

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

const SUBJECTS = [
  "{topic}", "Re: {topic}", "Quick one about {topic}", "Following up on {topic}",
  "Checking in", "A quick note", "Just checking in", "Quick question",
  "Circling back", "Thought you might like this", "{topic} — still on track?",
];

// One-off short replies, the kind that pepper a real inbox. Kept separate so
// they are used sparsely but present.
const QUICK_REPLIES: Array<{ subject: string; body: string }> = [
  { subject: "Re: schedule", body: "Does 3pm work instead of the morning slot?" },
  { subject: "Re: that thing", body: "Got it, thanks!" },
  { subject: "Re: notes", body: "Sounds good, talk soon." },
  { subject: "Re: check-in", body: "Just following up on this — no rush." },
  { subject: "Re: timing", body: "No worries, whenever works for you." },
  { subject: "Re: plans", body: "Works for me. See you then." },
  { subject: "Re: question", body: "Let me look and get back to you shortly." },
  { subject: "Re: update", body: "Thanks for the heads-up, noted!" },
];

// A situation is a single coherent small-talk scene with its own opener and
// ask, so topic, opener, and closer always fit together naturally.
interface Situation {
  topic: string;
  openers: string[];
  asks: string[];
}

interface Category {
  name: string;
  situations: Situation[];
}

const CATEGORIES: Category[] = [
  {
    name: "Work & professional",
    situations: [
      { topic: "how the project is going", openers: ["How is the project treating you?", "Just wanted to check in on the project."], asks: ["Any blockers on your end?", "How are things tracking?"] },
      { topic: "the meeting we had to reschedule", openers: ["I had to shuffle a few things around on my end.", "That meeting we moved keeps slipping."], asks: ["Does {time} work for a quick catch-up?", "When would work for you to reschedule?"] },
      { topic: "finding time for a call this week", openers: ["I have a bit of breathing room this week.", "My week cleared up a little."], asks: ["Are you free for a short call?", "Does {time} work?"] },
      { topic: "the thing we finally wrapped up", openers: ["We finally wrapped up the thing we talked about.", "Good news — that item is finally done."], asks: ["Celebrating a bit on my end.", "Happy to share the details if useful."] },
      { topic: "a draft I am working on", openers: ["I have been working on a draft I would love a second set of eyes on.", "I am polishing a draft and would value your take."], asks: ["Have a moment to look at it?", "Any quick thoughts when you can?"] },
      { topic: "how the day went", openers: ["Long day on my end.", "It has been one of those days."], asks: ["How was yours?", "Hope yours was calmer."] },
      { topic: "your new role", openers: ["Congrats again on the new role.", "How is the new role treating you?"], asks: ["How has the first stretch been?", "Enjoying it so far?"] },
      { topic: "a tool I found", openers: ["I stumbled on a small tool that made my day easier.", "Found a nifty tool worth passing along."], asks: ["Can pass it your way if useful.", "Worth a look whenever you get a sec."] },
      { topic: "thanking you for the help", openers: ["Just wanted to say thanks again for the help earlier.", "Your help the other day made a real difference."], asks: ["Hoping I can return the favor sometime.", "Anything I can do for you in return?"] },
      { topic: "the thing I sent over", openers: ["Circling back on the thing I sent over.", "Following up on what I shared with you."], asks: ["Did you get a chance to look at it?", "Any initial thoughts?"] },
      { topic: "how your home setup is going", openers: ["You mentioned your setup earlier.", "Curious how working from wherever you are is treating you."], asks: ["How is it working out?", "Any tips?"] },
      { topic: "a productivity habit", openers: ["Came across a habit that has helped me focus.", "Small thing that has been helping me lately."], asks: ["Ever try anything like it?", "Worth a try on your end?"] },
      { topic: "the deadline we agreed on", openers: ["Checking on the timeline we set.", "Wanted to confirm the deadline still holds."], asks: ["Are we still on track?", "Does the date still work?"] },
    ],
  },
  {
    name: "Food & drink",
    situations: [
      { topic: "a restaurant worth trying", openers: ["I have been craving somewhere new to eat.", "Looking for a good spot this weekend."], asks: ["Any place you would recommend?", "How is your go-to spot these days?"] },
      { topic: "a recipe I tried", openers: ["Tried a new recipe last night and it came out well.", "Made something new in the kitchen this week."], asks: ["Want the recipe?", "Any favorites you have been making?"] },
      { topic: "a coffee shop I found", openers: ["Stumbled on a small coffee place I like.", "Found a new coffee spot that is worth the stop."], asks: ["Do you have a usual place?", "Worth trying it sometime?"] },
      { topic: "what you are cooking this weekend", openers: ["Thinking about what to cook this weekend.", "Weekend plans in the kitchen?"], asks: ["What are you making?", "Giving anything new a shot?"] },
      { topic: "a delivery that missed the mark", openers: ["Ordered in last night and it was a letdown.", "The food delivery I tried was a miss."], asks: ["Do you have a go-to place?", "Any spots you trust?"] },
      { topic: "a new food spot opening", openers: ["Heard a new spot is opening nearby.", "Saw a new place is opening up soon."], asks: ["Have you heard about it?", "Planning to check it out?"] },
      { topic: "a food opinion debate", openers: ["Someone got me thinking about pineapple on pizza.", "We got into a small food debate the other day."], asks: ["What side are you on?", "Any strong opinions there?"] },
      { topic: "meal prepping", openers: ["Trying to get better at meal prep.", "Thinking about planning meals for the week."], asks: ["Do you meal prep?", "Any tips for keeping it simple?"] },
    ],
  },
  {
    name: "Travel",
    situations: [
      { topic: "your recent trip", openers: ["How was your trip?", "Hope you had a good one away."], asks: ["Any highlights?", "What was the best part?"] },
      { topic: "a weekend getaway", openers: ["Thinking about a quick weekend trip.", "Considering getting away for a weekend."], asks: ["Any spots you would suggest?", "Do you have a preference between driving and flying?"] },
      { topic: "the flight delay", openers: ["Spent most of yesterday waiting on a delayed flight.", "My flight ended up hours late."], asks: ["How do you usually handle delays?", "Any tips?"] },
      { topic: "packing for a trip", openers: ["Packing for a short trip and trying to keep it light.", "Attempting the carry-on-only thing again."], asks: ["Any packing tips?", "What do you never leave without?"] },
      { topic: "a bucket-list destination", openers: ["I keep coming back to one destination on my list.", "There is a place I really want to see one day."], asks: ["Have you been?", "What is on your list?"] },
      { topic: "a place I found to stay", openers: ["Found a good spot to stay for an upcoming trip.", "Booked somewhere nice for the next trip."], asks: ["How do you usually pick places?", "Prefer a place with a kitchen?"] },
      { topic: "travel paperwork", openers: ["Sorting out paperwork for an upcoming trip.", "Trying to get the logistics of a trip sorted."], asks: ["How was the process for you last time?", "Any gotchas to watch for?"] },
    ],
  },
  {
    name: "Fitness & health",
    situations: [
      { topic: "your gym routine", openers: ["How is the gym routine going?", "I have been trying to stay consistent at the gym."], asks: ["What does your week look like?", "Any sessions you enjoy most?"] },
      { topic: "your walking habit", openers: ["I have been walking a lot more lately.", "Getting into the habit of daily walks."], asks: ["Do you walk much?", "Any favorite routes?"] },
      { topic: "how your sleep has been", openers: ["My sleep has been all over the place.", "Been trying to fix my sleep schedule."], asks: ["How are you sleeping these days?", "Anything that works well for you?"] },
      { topic: "steps this week", openers: ["Hitting a step milestone actively.", "Managed a good step count this week."], asks: ["How is your step count looking?", "Do you track it?"] },
      { topic: "stretching or mobility", openers: ["Trying to stretch more before workouts.", "Looking into adding stretching to my days."], asks: ["Any routines you would recommend?", "Do you stretch regularly?"] },
      { topic: "a sport I am trying", openers: ["Have been trying out a new sport.", "Recently got into a sport I never tried before."], asks: ["Ever given it a go?", "Do you play anything?"] },
    ],
  },
  {
    name: "Entertainment",
    situations: [
      { topic: "the show I finished", openers: ["Binged a show recently and could not stop.", "Finished a series that surprised me."], asks: ["Have you seen it?", "Any recommendations your way?"] },
      { topic: "a book worth reading", openers: ["Reading a book I keep thinking about.", "Just finished something well worth reading."], asks: ["What are you reading these days?", "Want my copy when I am done?"] },
      { topic: "a podcast I found", openers: ["Found a podcast that has been great company.", "Started listening to a new podcast lately."], asks: ["Do you listen to podcasts?", "Any favorites?"] },
      { topic: "the game everyone is playing", openers: ["People keep bringing up this one game.", "Everyone seems to be playing the same thing lately."], asks: ["Have you tried it?", "What are you playing?"] },
      { topic: "last night's game", openers: ["Caught the game last night.", "Almost missed the match last night."], asks: ["Did you watch it?", "What did you think of it?"] },
      { topic: "an album I have on repeat", openers: ["Found an album I have had on repeat.", "Been listening to the same music on a loop."], asks: ["What are you listening to?", "Any bands I should hear?"] },
      { topic: "an event coming up", openers: ["Saw an event coming up I am thinking about.", "There is a show or event I might go to."], asks: ["Are you going to anything soon?", "Is it worth going to?"] },
    ],
  },
  {
    name: "Weather & everyday life",
    situations: [
      { topic: "the weather lately", openers: ["The weather has been something else lately.", "That weather we have been having is a handful."], asks: ["How is it where you are?", "Any plans to enjoy it while it lasts?"] },
      { topic: "a home project", openers: ["Started painting a room over the weekend.", "Finally fixing that thing at home."], asks: ["Done any projects lately?", "Any tips from experience?"] },
      { topic: "a pet update", openers: ["My pet did the funniest thing yesterday.", "The pet has been keeping things lively here."], asks: ["How are yours doing?", "Do you have pets?"] },
      { topic: "the weekend chores", openers: ["Weekends have been all chores lately.", "The to-do list at home keeps growing."], asks: ["What is your weekend looking like?", "Any of it enjoyable?"] },
      { topic: "a local recommendation", openers: ["Looking for a local recommendation.", "Need someone reliable nearby for a small job."], asks: ["Anyone you would trust?", "What do you usually do in that situation?"] },
      { topic: "a small purchase", openers: ["Got a small thing for the place recently.", "Bought a little gadget that has been handy."], asks: ["Ever tried something similar?", "Any finds you would recommend?"] },
    ],
  },
  {
    name: "Shopping",
    situations: [
      { topic: "a product worth recommending", openers: ["Been weighing two products for a while.", "Trying to decide on something to buy."], asks: ["Any experience with either?", "What would you pick?"] },
      { topic: "a good deal I found", openers: ["Found a decent deal on something I wanted.", "The thing I wanted went on sale."], asks: ["Have you been looking at one too?", "Worth sharing the find?"] },
      { topic: "an order that arrived", openers: ["That online order finally arrived.", "The package landed yesterday."], asks: ["Order anything lately?", "How did you find it?"] },
      { topic: "a subscription worth trying", openers: ["Thinking about trying a new subscription.", "A subscription service has been worth it so far this month."], asks: ["Any service you actually stick with?", "Worth the money?"] },
    ],
  },
  {
    name: "Social, light",
    situations: [
      { topic: "your weekend plans", openers: ["Any plans this weekend?", "What does the weekend look like for you?"], asks: ["Anything fun?", "Keeping it low-key?"] },
      { topic: "a family visit", openers: ["Had family over recently.", "Visited family for a bit."], asks: ["How is your side doing?", "Any visits planned soon?"] },
      { topic: "a small celebration", openers: ["There is a small milestone coming up.", "Planning something small for a celebration."], asks: ["How would you mark the occasion?", "Any suggestions?"] },
      { topic: "how the kids or pets are", openers: ["How is everything with the little ones — kids or pets?", "Curious how the family is getting on."], asks: ["Everything good?", "Any big news?"] },
      { topic: "a small congratulations", openers: ["Saw the news — congrats!", "Heard about the recent milestone — nice work."], asks: ["How are you celebrating?", "When is the right time to catch up properly?"] },
    ],
  },
  {
    name: "Learning & curiosity",
    situations: [
      { topic: "an article I read", openers: ["Read an article that stuck with me.", "Came across something interesting to read."], asks: ["Seen it too?", "Any good reads your way?"] },
      { topic: "a skill I am picking up", openers: ["I have been learning a new skill on the side.", "Picking up something new lately."], asks: ["Anything you are learning?", "How do you find the time?"] },
      { topic: "a course I am taking", openers: ["Started a short course a while back.", "Enrolled in something to level up a skill."], asks: ["Ever take online courses?", "Any you would recommend?"] },
      { topic: "a fun fact", openers: ["Learned a fun fact that I keep bringing up.", "Something I read made me curious this week."], asks: ["What is a fact you always share?", "Interesting things you have come across lately?"] },
      { topic: "picking up a hobby", openers: ["Thinking about starting a hobby again.", "Looking for something to do with free time."], asks: ["What do you do to unwind?", "How did you get into it?"] },
    ],
  },
  {
    name: "Gigs & freelance",
    situations: [
      { topic: "landing a new client", openers: ["Just landed a new client and it feels good.", "A new project came through on my end."], asks: ["How has that been going for you?", "Do you juggle many at once?"] },
      { topic: "how the freelance life is treating you", openers: ["How is the freelance life treating you?", "Curious how the independent work is going."], asks: ["Busy or slow lately?", "Any ups and downs worth sharing?"] },
      { topic: "a client who went quiet", openers: ["One client has gone quiet on me.", "Been chasing a response from a client."], asks: ["How do you normally handle that?", "Give it time or nudge them?"] },
      { topic: "a rate negotiation", openers: ["Had a rate negotiation go well.", "Finally raised my rates without losing anyone."], asks: ["How do you approach pricing?", "Ever had to hold your ground?"] },
      { topic: "gig platforms", openers: ["Trying to figure out which platform is worth it.", "Weighing where to find more work."], asks: ["Which have worked for you?", "Any you would skip?"] },
      { topic: "juggling multiple clients", openers: ["Juggling a few clients at once at the moment.", "The plates are spinning over here."], asks: ["How do you keep it manageable?", "Any systems that help?"] },
      { topic: "the first paid gig", openers: ["Remembering my first paid gig.", "The first paying project is nerve-racking in a good way."], asks: ["How did you get your start?", "What would you tell a beginner?"] },
      { topic: "getting paid on time", openers: ["Waiting on a payment that is running late.", "The invoicing side is always the slowest part."], asks: ["How do you keep cash flow steady?", "Any invoicing tips?"] },
      { topic: "full-time vs side hustle", openers: ["Thinking about whether to go full-time with it.", "Weighing full-time freelance against keeping a side thing."], asks: ["What made you decide either way?", "Any advice there?"] },
      { topic: "a portfolio update", openers: ["Updated my portfolio recently.", "Refreshing the work I show people."], asks: ["How do you present your work?", "Happy to trade notes on it?"] },
      { topic: "a proposal review", openers: ["Working on a proposal and would like a second look.", "Drafted a pitch and want it to land well."], asks: ["Any quick notes when you have a minute?", "What makes it read well to you?"] },
    ],
  },
  {
    name: "Fundraising / startup chat",
    situations: [
      { topic: "how the raise is going", openers: ["How is the raise going?", "Curious how the fundraising effort is coming along."], asks: ["How does the process feel so far?", "Any surprises?"] },
      { topic: "closing a round", openers: ["Congrats on closing the round!", "Nice work getting that one over the line."], asks: ["How is it feeling?", "What is next after closing?"] },
      { topic: "pitching nerves", openers: ["Thinking a lot about pitching these days.", "Preparing for some upcoming conversations with investors."], asks: ["How do you handle the nerves?", "Any rituals before a pitch?"] },
      { topic: "advice on connections", openers: ["Looking for a warm introduction somewhere.", "Trying to find good people to talk to in this space."], asks: ["Do you have tips for making connections?", "How have meetings gone for you?"] },
      { topic: "cap table paperwork", openers: ["The paperwork side of fundraising is a lot.", "Spent the week on cap table documents."], asks: ["How did you get through yours?", "Anyone you leaned on for the legal bits?"] },
      { topic: "deck feedback", openers: ["Would appreciate a look at my deck this week.", "Working on the deck and wanting a fresh set of eyes."], asks: ["Have a minute to flip through it?", "What would you look for?"] },
      { topic: "how demo day went", openers: ["How did demo day go?", "Hope the presentation landed well."], asks: ["How was the reaction?", "Anything you would do differently?"] },
      { topic: "bootstrapping vs raising", openers: ["Thinking about whether to bootstrap or raise.", "Still deciding between going it alone and taking money."], asks: ["What made you choose your path?", "Any regrets either way?"] },
    ],
  },
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
    bare: n1 % 100 < 12,
  };
}

const SITUATION_COUNT = CATEGORIES.reduce((n, c) => n + c.situations.length, 0);

// Build the topic list fed to AI dynamically from the template pool so both
// paths draw from the same set of niches.  One line per category, topics
// separated by commas — compact enough for one prompt token block.
const AI_TOPICS = CATEGORIES.map(c => `${c.name}: ${c.situations.map(s => s.topic).join(", ")}`).join("\n");

// Seed senders now use AI when the API key is present (templates are the
// fallback). They skip WarmupContent dedup tracking (keyed to
// senderMailboxId — seeds don't have one).
export async function generateSeedWarmupContent(
  seedId: string,
  senderName: string,
  recipientName: string,
  tags: string[] = [],
  filterTag = "",
): Promise<{ subject: string; body: string }> {
  const voice = accountVoice(seedId);
  let content: { subject: string; body: string } | null = null;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    // Seeds aren't in warmupContent (that's keyed to senderMailboxId), so pull
    // their recent copy from warmupLog to steer the AI away from covered topics.
    const recentLogs = await prisma.warmupLog.findMany({
      where: { senderInboxId: seedId, status: { in: ["sent", "delivered"] }, subject: { not: null } },
      orderBy: { sentAt: "desc" },
      take: 8,
      select: { subject: true },
    });
    const recentSubjects = recentLogs.map(l => String(l.subject).slice(0, 60));
    content = await generateViaAI(senderName, recipientName, apiKey, voice, recentSubjects);
  }

  if (!content) {
    content = buildTemplateContent(seedId, senderName, recipientName);
  }

  let { subject, body } = content;
  if (tags.length > 0) {
    const subjectTag = spinSubjectTag(tags);
    if (subjectTag) subject = `${subject} ${subjectTag}`;
    body = `${body}\n\n${tags.join(" ")}`;
  }
  const code = (filterTag || "").trim();
  if (code) {
    subject = `${subject} ${code}`;
    body = `${body}\n${code}`;
  }
  return { subject, body };
}

function buildTemplateContent(mailboxId: string, senderName: string, recipientName: string): { subject: string; body: string } {
  const voice = accountVoice(mailboxId);
  const time = pick(TIMES);

  const greet = voice.bare ? "" : pick(voice.greeting) + (chance(0.6) && !voice.bare ? ` ${recipientName},` : ",");
  const courtesy = chance(voice.extChance) ? pick(COURTESY) : "";
  const signoff = voice.useName ? `${pick(voice.signoff)},\n${senderName}` : pick(voice.signoff);

  // Mix in a short quick-logistics note ~1 in 12 sends — real inboxes have
  // both one-liners and medium emails, and one without the other is a tell.
  if (chance(1 / 12)) {
    const q = pick(QUICK_REPLIES);
    const segments = [greet, q.body, courtesy].filter(Boolean);
    const body = `${segments.join(" ")}\n\n${signoff}`;
    return { subject: q.subject, body };
  }

  // Pick a category at random (never sequentially), then a situation inside it.
  const category = pick(CATEGORIES);
  const situation = pick(category.situations);
  const opener = pick(situation.openers);
  const ask = pick(situation.asks);

  const fill = (s: string) => s.replace("{topic}", situation.topic).replace("{time}", time);
  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const subject = capitalize(fill(pick(SUBJECTS)));
  const segments = [greet, fill(opener), courtesy, fill(ask)].filter(Boolean);
  const body = `${segments.join(" ")}\n\n${signoff}`;

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
  // Categorized pool (situations x openers x asks x subjects) — effectively
  // huge, so exhaustion-based reset is a safety net only (brings it onwards
  // when an account hits a great many sends).
  const poolSize = SITUATION_COUNT * 8 * 6;
  const exhaustionPercent = poolSize > 0 ? Math.min(100, (totalUsed / poolSize) * 100) : 0;
  return { poolExhaustionPercent: exhaustionPercent, totalUsed };
}

async function resetUsedContent(senderMailboxId: string): Promise<void> {
  await prisma.warmupContent.deleteMany({
    where: { senderMailboxId },
  });
}

async function generateViaAI(
  senderName: string,
  recipientName: string,
  apiKey: string,
  voice: Voice,
  recentSubjects: string[],
): Promise<{ subject: string; body: string } | null> {
  const tone = TONES[Math.floor(Math.random() * TONES.length)];
  const greetingOptions = voice.greeting.join(" / ");
  const signoffOptions = voice.signoff.join(" / ");
  const useName = voice.useName ? "Yes — always include the sender's first name" : "No — use only the sign-off word, no name";
  const openingInstruction = voice.bare
    ? "Start directly with the topic — no greeting, no 'Hi X,'."
    : `Start with the greeting to ${recipientName}, e.g. \"Hey ${recipientName},\".`;
  const recentBlock = recentSubjects.length > 0
    ? recentSubjects.map(s => `- ${s}`).join("\n")
    : "None yet — this is this sender's first message.";
  const prompt = AI_PROMPT
    .replace("{tone}", tone)
    .replace("{sender_name}", senderName)
    .replace("{recipient_name}", recipientName)
    .replace("{greeting_options}", greetingOptions)
    .replace("{signoff_options}", signoffOptions)
    .replace("{use_name}", useName)
    .replace("{topics}", AI_TOPICS)
    .replace("{recent_subjects}", recentBlock)
    .replace("{opening_instruction}", openingInstruction);

  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

      const res = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          max_tokens: 250,
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
  recipientName: string,
  receiver: { seedMailboxId: string | null; seedInboxId: string | null },
): Promise<{ subject: string; body: string; source: string }> {
  const mailbox = await prisma.emailAccount.findUnique({
    where: { id: senderMailboxId },
    select: { warmupAiEnabled: true },
  });

  // Try AI first if enabled — the voice object keeps AI and template emails
  // sounding like the same person for this account.
  if (mailbox?.warmupAiEnabled) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey) {
      const voice = accountVoice(senderMailboxId);
      // Give the AI this sender's recent copy so it can steer away from the
      // niches it already covered (stateless model otherwise has no memory).
      const recentRows = await prisma.warmupContent.findMany({
        where: { senderMailboxId },
        orderBy: { usedAt: "desc" },
        take: 8,
        select: { subjectPreview: true },
      });
      const recentSubjects = recentRows.map(r => r.subjectPreview);
      const aiContent = await generateViaAI(senderName, recipientName, apiKey, voice, recentSubjects);
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
    const content = buildTemplateContent(senderMailboxId, senderName, recipientName);
    const duplicate = await isDuplicate(senderMailboxId, receiver, content.subject, content.body);
    if (!duplicate) {
      await recordUsedContent(senderMailboxId, receiver, content.subject, content.body, "templates");
      return { ...content, source: "templates" };
    }
  }

  await resetUsedContent(senderMailboxId);
  const content = buildTemplateContent(senderMailboxId, senderName, recipientName);
  await recordUsedContent(senderMailboxId, receiver, content.subject, content.body, "templates");
  return { ...content, source: "templates" };
}