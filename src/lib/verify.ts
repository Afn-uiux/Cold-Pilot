import dns from "dns/promises";
import net from "net";
import { isDisposable } from "./disposable";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const ROLE_PREFIXES = [
  "admin","administrator","info","support","help","sales","marketing",
  "contact","webmaster","postmaster","hostmaster","abuse","noc","security",
  "billing","hr","team","office","legal","compliance","feedback","service",
  "hello","hey","general","reception","enquiry","enquiries","customerservice",
  "customersupport","accounts","payroll","tech","it","network","dns",
  "mail","mailer","daemon","auto","automated","no-reply","noreply",
  "donotreply","do-not-reply","notifications","notification","alert","alerts",
];

export type VerificationStatus = "valid" | "invalid" | "risky" | "catch_all" | "unknown";

export interface VerificationResult {
  status: VerificationStatus;
  reason: string;
  format?: boolean;
  disposable?: boolean;
  roleAccount?: boolean;
  mxValid?: boolean;
  smtpValid?: boolean;
  isCatchAll?: boolean;
}

function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

function extractLocal(email: string): string {
  return email.split("@")[0]?.toLowerCase() || "";
}

export function verifyFormat(email: string): boolean {
  if (!email || email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64) return false;
  if (!domain || !domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  return EMAIL_REGEX.test(email);
}

export async function verifyMX(email: string): Promise<{ valid: boolean; mxRecords: string[] }> {
  const domain = extractDomain(email);
  if (!domain) return { valid: false, mxRecords: [] };

  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) return { valid: false, mxRecords: [] };
    const sorted = records.sort((a, b) => a.priority - b.priority);
    return { valid: true, mxRecords: sorted.map(r => r.exchange) };
  } catch {
    return { valid: false, mxRecords: [] };
  }
}

function smtpVerify(email: string, mxHost: string): Promise<{ valid: boolean; catchAll: boolean; reason: string }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: mxHost, port: 25 });
    let buffer = "";
    let resolved = false;
    let step = 0;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch {}
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ valid: false, catchAll: false, reason: "timeout" });
    }, 8000);

    socket.on("connect", () => {
      step = 0;
    });

    socket.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.substring(0, 3), 10);

        if (step === 0) {
          step = 1;
          socket.write(`EHLO verify.coldpilot.com\r\n`);
        } else if (step === 1 && (code === 250 || code === 220)) {
          if (line.startsWith("250-")) continue;
          step = 2;
          socket.write(`MAIL FROM:<verify@coldpilot.com>\r\n`);
        } else if (step === 2 && (code === 250 || code === 220)) {
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 3) {
          if (code === 250 || code === 251) {
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: true, catchAll: false, reason: "mailbox_exists" });
          } else if (code === 550 || code === 551 || code === 553) {
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, catchAll: false, reason: "mailbox_not_found" });
          } else if (code === 452 || code === 451 || code === 450) {
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, catchAll: false, reason: "greylisted" });
          } else if (code === 552 || code === 554) {
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, catchAll: false, reason: "mailbox_full_or_rejected" });
          } else {
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, catchAll: false, reason: `smtp_${code}` });
          }
        } else if (step === 1 && code !== 250) {
          clearTimeout(timeout);
          cleanup();
          resolve({ valid: false, catchAll: false, reason: `ehlo_rejected_${code}` });
        } else if (step === 2 && code !== 250) {
          clearTimeout(timeout);
          cleanup();
          resolve({ valid: false, catchAll: false, reason: `mail_from_rejected_${code}` });
        }
      }
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ valid: false, catchAll: false, reason: "connection_error" });
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      cleanup();
      if (!resolved) {
        resolve({ valid: false, catchAll: false, reason: "connection_closed" });
      }
    });
  });
}

function generateRandomAddress(domain: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let rand = "";
  for (let i = 0; i < 16; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${rand}@${domain}`;
}

export async function verifyCatchAll(domain: string, mxHost: string): Promise<boolean> {
  const fakeEmail = generateRandomAddress(domain);
  const result = await smtpVerify(fakeEmail, mxHost);
  return result.valid;
}

const SMTP_UNREACHABLE_REASONS = new Set([
  "timeout", "connection_error", "connection_closed",
  "ehlo_rejected_421", "ehlo_rejected_451", "ehlo_rejected_452",
]);

export async function verifyEmail(email: string): Promise<VerificationResult> {
  const normalized = email.toLowerCase().trim();

  if (!verifyFormat(normalized)) {
    return { status: "invalid", reason: "invalid_format", format: false };
  }

  if (isDisposable(normalized)) {
    return { status: "risky", reason: "disposable_email", format: true, disposable: true };
  }

  const local = extractLocal(normalized);
  if (ROLE_PREFIXES.includes(local)) {
    return { status: "risky", reason: "role_account", format: true, roleAccount: true };
  }

  const { valid: mxValid, mxRecords } = await verifyMX(normalized);
  if (!mxValid || mxRecords.length === 0) {
    return { status: "invalid", reason: "no_mx_records", format: true, mxValid: false };
  }

  // Try SMTP verification, but fall back to MX-based verdict if unreachable
  const smtpResult = await smtpVerify(normalized, mxRecords[0]);

  if (smtpResult.valid) {
    // SMTP confirmed mailbox exists — now check catch-all
    const isCatchAll = await verifyCatchAll(extractDomain(normalized), mxRecords[0]);
    if (isCatchAll) {
      return { status: "catch_all", reason: "catch_all_domain", format: true, mxValid: true, smtpValid: true, isCatchAll: true };
    }
    return { status: "valid", reason: "mailbox_exists", format: true, mxValid: true, smtpValid: true, isCatchAll: false };
  }

  if (smtpResult.reason === "mailbox_not_found" || smtpResult.reason === "mailbox_full_or_rejected") {
    // Server explicitly rejected — definitely invalid
    return { status: "invalid", reason: smtpResult.reason, format: true, mxValid: true, smtpValid: false };
  }

  if (smtpResult.reason === "greylisted") {
    // Greylisted — can't confirm, treat as valid (MX exists, server just wants retry)
    return { status: "valid", reason: "mx_valid_greylisted", format: true, mxValid: true, smtpValid: false };
  }

  if (SMTP_UNREACHABLE_REASONS.has(smtpResult.reason)) {
    // Can't reach SMTP — fall back to MX-based verdict
    // MX exists = probably valid (server just won't talk to us)
    return { status: "valid", reason: "mx_valid_smtp_unreachable", format: true, mxValid: true, smtpValid: false };
  }

  // Any other SMTP error — fall back to MX-based
  return { status: "valid", reason: `mx_valid_${smtpResult.reason}`, format: true, mxValid: true, smtpValid: false };
}

export function canSendToLead(verificationStatus: string | null, enableRiskyEmails: boolean, disableBounceProtect: boolean): { allowed: boolean; reason: string } {
  if (!verificationStatus || verificationStatus === "unverified") {
    return { allowed: true, reason: "not_verified" };
  }
  if (verificationStatus === "valid") {
    return { allowed: true, reason: "valid" };
  }
  if (verificationStatus === "risky") {
    return { allowed: false, reason: "disposable_or_role_account" };
  }
  if (verificationStatus === "catch_all") {
    if (!disableBounceProtect) {
      return { allowed: true, reason: "catch_all_allowed" };
    }
    return { allowed: false, reason: "catch_all_blocked_by_bounce_protect" };
  }
  if (verificationStatus === "invalid") {
    return { allowed: false, reason: "invalid" };
  }
  if (verificationStatus === "unknown") {
    return { allowed: false, reason: "unknown" };
  }
  return { allowed: true, reason: "unknown_status" };
}
