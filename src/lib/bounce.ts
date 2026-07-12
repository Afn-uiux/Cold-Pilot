export function categorizeBounce(err: any): { type: string; suppress: boolean } {
  const msg = (err.message || "").toLowerCase();
  // Network / connection errors — the server couldn't reach the mail server at all.
  // These are NOT bounces and must never suppress the email address.
  if (msg.includes("ehostunreach") || msg.includes("econnrefused") || msg.includes("etimedout") ||
      msg.includes("enotfound") || msg.includes("epipe") || msg.includes("econnreset") ||
      msg.includes("connect") || msg.includes("network") || msg.includes("socket")) {
    return { type: "connection_error", suppress: false };
  }
  if (msg.includes("invalid_grant") || msg.includes("eauth") || msg.includes("eaccess")) return { type: "auth_error", suppress: false };
  if (msg.includes("550") && (msg.includes("does not exist") || msg.includes("invalid") || msg.includes("user unknown") || msg.includes("no such"))) return { type: "hard_bounce", suppress: true };
  if (msg.includes("552") || msg.includes("mailbox full") || msg.includes("over quota") || msg.includes("try again")) return { type: "soft_bounce", suppress: false };
  if (msg.includes("suppressed")) return { type: "suppressed", suppress: false };
  if (msg.includes("550") || msg.includes("554")) return { type: "hard_bounce", suppress: true };
  return { type: "hard_bounce", suppress: true };
}

export function extractBounceReason(err: any): string {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("invalid_grant") || msg.includes("eauth") || msg.includes("eaccess")) return "Invalid credentials";
  if (msg.includes("policy blocked") || msg.includes("5.7.1")) return "Policy blocked";
  if (msg.includes("does not exist") || msg.includes("no such")) return "Account does not exist";
  if (msg.includes("user unknown")) return "User unknown";
  if (msg.includes("mailbox full") || msg.includes("over quota")) return "Mailbox full";
  if (msg.includes("domain")) return "Domain invalid";
  if (msg.includes("suppressed")) return "Suppressed";
  if (msg.includes("try again")) return "Temporary failure";
  return msg.replace(/^\d{3}\s+\d+\.\d+\.\d+\s+/i, "").slice(0, 80) || "Unknown";
}

export function extractBounceStatus(err: any): string {
  const match = (err.message || "").match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : "";
}
