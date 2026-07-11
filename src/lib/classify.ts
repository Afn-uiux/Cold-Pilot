const POSITIVE_WORDS = ["interested", "let's talk", "call", "demo", "yes", "sure", "sounds good", "tell me more", "available", "book", "schedule", "looking forward", "sign me up", "proceed", "sounds interesting"];
const NEGATIVE_WORDS = ["unsubscribe", "stop", "remove", "not interested", "leave me alone", "spam", "block", "do not email", "cease", "opt out", "wrong person", "not the right", "take me off", "never mind", "lost interest", "no longer"];
const AUTO_REPLY_WORDS = ["out of office", "ooo", "vacation", "on leave", "return", "away from", "not in the office", "on holiday", "automatic reply", "automated reply", "i am out", "will be back"];

export function classifyReply(subject: string, body: string): string {
  const text = `${subject} ${body}`.toLowerCase();

  for (const word of AUTO_REPLY_WORDS) {
    if (text.includes(word)) return "auto_reply";
  }

  for (const word of NEGATIVE_WORDS) {
    if (text.includes(word)) return "negative";
  }

  for (const word of POSITIVE_WORDS) {
    if (text.includes(word)) return "positive";
  }

  return "neutral";
}
