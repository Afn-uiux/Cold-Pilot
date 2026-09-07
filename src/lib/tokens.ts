import { createHash } from "crypto";

// Password-reset and email-verification tokens are single-use capability
// secrets delivered by email. Storing the raw token would let anyone with a
// DB leak replay every in-flight token as account compromise (audit M-5), so
// records only ever store SHA-256(token). The plaintext travels only in the
// emailed link; lookups and deletes always go through hashToken().
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}