export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync } from "@/lib/rate-limit";
import { loadKnowledgeBase } from "@/lib/knowledge-base";
import { getPlan } from "@/lib/plans";
import { getTrialStatus, trialGrantsFeatureAccess } from "@/lib/trial";
import { isPayAsYouGo } from "@/lib/credits";
import { sendEmailSafe } from "@/lib/email/send";

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  // DeepSeek 429s on bursts. One polite retry clears most transient throttles.
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
        max_tokens: 1024,
        messages,
        temperature: 0.6,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, byAdmin: true, content: true, createdAt: true },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Support chat is a free, always-on feature (no credits spent) but still
  // needs a burst cap so the shared DeepSeek key isn't hammered.
  const rl = await rateLimitAsync(`support:${session.user.id}`, { max: 20, windowMs: 60_000 });
  const currentUserId = session.user.id;
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're messaging us very quickly. Slow down a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const body = await req.json();
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      plan: true,
      creditBalance: true,
      createdAt: true,
      trialEndsAt: true,
      trialVoided: true,
    },
  });

  // When a user explicitly asks for a real person, alert the operator inbox so
  // a human can take over. Fire-and-forget — a delivery hiccup must never fail
  // the chat itself.
  const wantsHuman = /(human|real person|representative|agent|support (member|agent|staff)|talk (to|with) someone|speak (to|with) (a|someone)|someone real)/i.test(message);
  const operatorInbox = process.env.WAITLIST_NOTIFY_TO;
  if (wantsHuman && operatorInbox) {
    sendEmailSafe(operatorInbox, "support-chat-escalation", {
      user: user?.name ?? "a Coldpilot user",
      email: user?.email ?? "(unknown)",
      message,
    });
  }

  // Persist the user's message so the thread is visible in the admin inbox.
  await prisma.chatMessage.create({
    data: { userId: currentUserId, role: "user", content: message },
  });

  async function persistAssistant(content: string) {
    await prisma.chatMessage.create({
      data: { userId: currentUserId, role: "assistant", content },
    });
  }

  if (!AI_API_KEY) {
    const reply =
      "Thanks for reaching out! I'd normally answer right here, but our AI assistant isn't configured on this instance yet. Please email support at hello@usecoldpilot.com and we'll get back to you quickly. You can also keep this chat open — it'll work as soon as AI is connected.";
    await persistAssistant(reply);
    return NextResponse.json({ reply }, { status: 200 });
  }

  const plan = getPlan(user?.plan);
  const trial = getTrialStatus(user?.plan ?? "free", user?.trialEndsAt ?? null, user?.trialVoided ?? false);
  const payg = isPayAsYouGo(user?.plan, user?.creditBalance);
  const aiActive = plan.aiEnabled || trialGrantsFeatureAccess(user?.plan, user?.trialEndsAt ?? null, user?.trialVoided ?? false) || payg;
  const leadLimit = payg ? Infinity : plan.leadLimit;
  const inboxLimit = plan.inboxLimit;

  const kb = loadKnowledgeBase();

  const accountContext = [
    user ? `The person chatting is logged in as ${user.name || "a Coldpilot user"} (${user.email}).` : "",
    user?.plan ? `Their current plan is: ${user.plan}.` : "",
    `Plan name: ${plan.name}. Credit balance: ${user?.creditBalance ?? 0}.`,
    `Lead limit: ${leadLimit === Infinity ? "unlimited (pay-as-you-go)" : leadLimit}. Inbox limit: ${inboxLimit === Infinity ? "unlimited" : inboxLimit}. AI enabled: ${aiActive}. Pay-as-you-go: ${payg}. Trial active: ${trial.active}.`,
    user?.createdAt ? `They signed up on ${user.createdAt.toISOString().slice(0, 10)}.` : "",
  ].filter(Boolean).join("\n");

  const systemPrompt =
    `You are Ava, the friendly support assistant at Coldpilot — a cold-email automation platform. ` +
    `You help logged-in users with anything about Coldpilot: plans, credits, warmup, connecting inboxes, campaigns, leads, verification, deliverability, security, signup, and login. ` +
    `\n\nPERSONALITY: Be warm, positive, helpful, and conversational — like a real human support rep, not a bot. ` +
    `Never be negative, dismissive, or discouraging. If something is limited by their plan, frame it as a positive next step ("great news — upgrading unlocks this") rather than as a restriction. ` +
    `Celebrate what the user can do. Use first person ("I", "we"), keep answers friendly, and match a light, encouraging tone. ` +
    `\n\nOUTPUT RULES — strictly follow these: ` +
    `Write like a professional human support rep: short, clean paragraphs of plain prose. ` +
    `NEVER use markdown of any kind — no asterisks, no bold, no italics, no bullet lists, no headings, no numbered lists, no em dashes. ` +
    `Answer ONLY what the user asked. Do not volunteer extra facts, disclaimers, appendices, or unrelated details about Coldpilot. ` +
    `Do not pad responses with filler openers, generic pleasantries, or repeated phrases. Never start with the same opener twice in a row. ` +
    `Be direct and efficient: answer in as few words as needed, then stop. If the user's question can be answered in a sentence or two, keep it that short. ` +
    `Only use phrases like "great question" sparingly or not at all — prefer a plain, direct answer.` +
    `\n\nNEVER, under any circumstances, discuss the platform's internal backend, database, infrastructure, schemas, tables, servers, or technical internals. ` +
    `This is an absolute rule. If a user asks how something is stored, where data lives, what the database looks like, how many users are in the database, or any similar technical-internal question, ` +
    `do NOT speculate or explain internals. Instead, briefly reassure them that data is stored securely and handled with care, then redirect to what they can see or change in their own account. Keep it short and positive.` +
    `\n\nKNOWLEDGE BASE — draw your answer ONLY from this documentation. It is the accurate, current source of truth for Coldpilot. ` +
    `If the user asks about something the knowledge base doesn't cover, say you're not 100% sure and offer to get a human support member to help — but stay positive and keep the door open. Never invent features, prices, or policies. ` +
    `\n\nACCOUNT CONTEXT (use this to personalize your answer — for example, remind them of their own plan limit or credit balance where relevant):\n` +
    `${accountContext}\n\n` +
    `DOCUMENTATION:\n${kb}`;

  try {
    const reply = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);
    await persistAssistant(reply);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[support-chat] AI call failed:", (err as Error).message);
    const reply =
      "I'm having a quick technical hiccup on my side — give me a few seconds and try again. If it keeps happening, you can always reach us directly at hello@usecoldpilot.com and we'll take care of you quickly!";
    await persistAssistant(reply);
    return NextResponse.json({ reply }, { status: 200 });
  }
}