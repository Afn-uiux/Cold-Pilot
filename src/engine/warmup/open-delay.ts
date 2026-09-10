import { createHash } from "crypto";

// Deterministic simulated "mailbox opened at" delay for an inbound warmup.
// The literal message is delivered seconds after send, but for warmup realism we
// pretend the recipient's mailbox wasn't checked until this many minutes later —
// instant.ai-style gaps between send and receive. Derived from the log id so the
// value is stable across ticks/restarts (the reader holds a message until the
// wall clock passes sentAt + delay, then marks it received/read exactly once).
//
// INBOX reads use a longer window (40min .. ~4.6h); spam/promo RESCUES use a
// shorter one (20min .. 90min) so recovery from junk still happens promptly.
export function openDelayMinutes(logId: string, min = 40, max = 240): number {
  const h = createHash("sha256").update(`warmup-open:${min}:${max}:${logId}`).digest();
  const i = h.readUInt32BE(0);
  return min + (i % (max - min + 1));
}