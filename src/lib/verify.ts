import dns from "dns/promises";
import net from "net";
import tls from "tls";
import { isDisposable } from "./disposable";
import { isTyposquat } from "./typosquat";
import { getDomainReputation, isHighBounceDomain, isMediumBounceDomain } from "./domain-reputation";

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

export type VerificationStatus = "valid" | "invalid" | "risky" | "unknown";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  email: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  reason: string;
  provider: string;
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

const PROVIDER_MX_MAP: [RegExp, string][] = [
  [/google\.|gmail\.|googlemail\./i, "Google"],
  [/yahoo\.|yahooding/i, "Yahoo"],
  [/outlook\.|office365\.|microsoft\./i, "Microsoft"],
  [/protonmail\.|proton\.|protonmail.ch/i, "ProtonMail"],
  [/zoho\./i, "Zoho"],
  [/aol\.|aim\./i, "AOL"],
  [/icloud\.|me\.|mac\.com/i, "Apple"],
  [/gmx\./i, "GMX"],
  [/mail\.ru|inbox\.ru|list\.ru/i, "Mail.ru"],
  [/yandex\./i, "Yandex"],
  [/fastmail\./i, "Fastmail"],
  [/tutanota\.|tutamail\./i, "Tutanota"],
];

export function detectProvider(mxRecords: string[]): string {
  const joined = mxRecords.join(" ");
  for (const [pattern, name] of PROVIDER_MX_MAP) {
    if (pattern.test(joined)) return name;
  }
  return "Other";
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

function smtpVerifyViaAccount(targetEmail: string, config: SmtpConfig): Promise<{ valid: boolean; reason: string }> {
  return new Promise((resolve) => {
    const useTls = config.port === 465;
    let socket: net.Socket;
    let resolved = false;
    let buffer = "";
    let step = 0;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch {}
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ valid: false, reason: "account_smtp_timeout" });
    }, 15000);

    if (useTls) {
      socket = tls.connect({ host: config.host, port: config.port, rejectUnauthorized: false }, () => {
        step = 0;
      });
    } else {
      socket = net.createConnection({ host: config.host, port: config.port });
    }

    socket.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.substring(0, 3), 10);

        if (step === 0) {
          step = 1;
          socket.write(`EHLO coldpilot.com\r\n`);
        } else if (step === 1 && code === 250) {
          if (!useTls && /STARTTLS/i.test(line)) {
            step = 11;
            socket.write("STARTTLS\r\n");
            continue;
          }
          if (line.startsWith("250-")) continue;
          step = 2;
          socket.write(`AUTH LOGIN\r\n`);
        } else if (step === 11 && code === 220) {
          const secureSocket = tls.connect({ socket, rejectUnauthorized: false }, () => {
            step = 1;
            buffer = "";
            socket.write(`EHLO coldpilot.com\r\n`);
          });
          secureSocket.on("data", (d: Buffer) => {
            buffer += d.toString();
            const lns = buffer.split("\r\n");
            buffer = lns.pop() || "";
            for (const ln of lns) {
              if (!ln) continue;
              const c = parseInt(ln.substring(0, 3), 10);
              if (step === 1 && c === 250) {
                if (ln.startsWith("250-")) continue;
                step = 2;
                socket.write(`AUTH LOGIN\r\n`);
              }
            }
          });
          secureSocket.on("error", () => { clearTimeout(timeout); cleanup(); resolve({ valid: false, reason: "account_tls_error" }); });
          secureSocket.on("close", () => { clearTimeout(timeout); cleanup(); if (!resolved) resolve({ valid: false, reason: "account_tls_closed" }); });
          return;
        } else if (step === 1 && code !== 250) {
          clearTimeout(timeout);
          cleanup();
          resolve({ valid: false, reason: `account_ehlo_rejected_${code}` });
          return;
        } else if (step === 2 && /334/.test(line.substring(0, 3))) {
          step = 3;
          socket.write(Buffer.from(config.user).toString("base64") + "\r\n");
        } else if (step === 3 && /334/.test(line.substring(0, 3))) {
          step = 4;
          socket.write(Buffer.from(config.pass).toString("base64") + "\r\n");
        } else if (step === 4) {
          if (code === 235) {
            step = 5;
            socket.write(`MAIL FROM:<${config.email}>\r\n`);
          } else {
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, reason: "account_auth_failed" });
          }
        } else if (step === 5 && code === 250) {
          step = 6;
          socket.write(`RCPT TO:<${targetEmail}>\r\n`);
        } else if (step === 5 && code !== 250) {
          clearTimeout(timeout);
          cleanup();
          resolve({ valid: false, reason: `account_mail_from_rejected_${code}` });
        } else if (step === 6) {
          if (code === 250 || code === 251) {
            socket.write("QUIT\r\n");
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: true, reason: "mailbox_exists" });
          } else if (code === 550 || code === 551 || code === 553) {
            socket.write("QUIT\r\n");
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, reason: "mailbox_not_found" });
          } else if (code === 452 || code === 451 || code === 450) {
            socket.write("QUIT\r\n");
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, reason: "greylisted" });
          } else if (code === 552 || code === 554) {
            socket.write("QUIT\r\n");
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, reason: "mailbox_full_or_rejected" });
          } else {
            socket.write("QUIT\r\n");
            clearTimeout(timeout);
            cleanup();
            resolve({ valid: false, reason: `account_smtp_${code}` });
          }
        }
      }
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ valid: false, reason: "account_connection_error" });
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      cleanup();
      if (!resolved) {
        resolve({ valid: false, reason: "account_connection_closed" });
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
  const tests = [
    generateRandomAddress(domain),
    generateRandomAddress(domain),
    generateRandomAddress(domain),
  ];
  const results = await Promise.all(tests.map(email => smtpVerify(email, mxHost)));
  return results.every(r => r.valid);
}

const SMTP_UNREACHABLE_REASONS = new Set([
  "timeout", "connection_error", "connection_closed",
  "ehlo_rejected_421", "ehlo_rejected_451", "ehlo_rejected_452",
]);

export async function verifyEmail(email: string, smtpConfig?: SmtpConfig): Promise<VerificationResult> {
  const normalized = email.toLowerCase().trim();

  if (!verifyFormat(normalized)) {
    return { status: "invalid", reason: "invalid_format", provider: "Unknown", format: false };
  }

  if (isDisposable(normalized)) {
    return { status: "risky", reason: "disposable_email", provider: "Unknown", format: true, disposable: true };
  }

  const domain = extractDomain(normalized);
  if (isTyposquat(domain)) {
    return { status: "invalid", reason: "typosquat_domain", provider: "Unknown", format: true };
  }

  const local = extractLocal(normalized);
  if (ROLE_PREFIXES.includes(local)) {
    return { status: "risky", reason: "role_account", provider: "Unknown", format: true, roleAccount: true };
  }

  const { valid: mxValid, mxRecords } = await verifyMX(normalized);
  if (!mxValid || mxRecords.length === 0) {
    return { status: "invalid", reason: "no_mx_records", provider: "Unknown", format: true, mxValid: false };
  }

  const provider = detectProvider(mxRecords);

  const reputation = await getDomainReputation(domain);

  if (isHighBounceDomain(reputation)) {
    return {
      status: "risky",
      reason: `high_bounce_domain_${Math.round(reputation.bounceRate * 100)}pct`,
      provider,
      format: true,
      mxValid: true,
    };
  }

  if (smtpConfig) {
    const accountResult = await smtpVerifyViaAccount(normalized, smtpConfig);

    if (accountResult.valid) {
      const isCatchAll = await verifyCatchAll(domain, mxRecords[0]);
      if (isCatchAll) {
        return { status: "invalid", reason: "catch_all_domain", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: true };
      }
      return { status: "valid", reason: "mailbox_exists", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: false };
    }

    if (accountResult.reason === "mailbox_not_found" || accountResult.reason === "mailbox_full_or_rejected") {
      return { status: "invalid", reason: accountResult.reason, provider, format: true, mxValid: true, smtpValid: false };
    }

    if (accountResult.reason === "greylisted") {
      return { status: "unknown", reason: "greylisted", provider, format: true, mxValid: true, smtpValid: false };
    }

    if (accountResult.reason === "account_auth_failed" || accountResult.reason === "account_connection_error" || accountResult.reason === "account_connection_closed" || accountResult.reason === "account_smtp_timeout" || accountResult.reason === "account_tls_error" || accountResult.reason === "account_tls_closed") {
      // Account SMTP failed — fall back to raw port 25
    } else {
      return { status: "invalid", reason: accountResult.reason, provider, format: true, mxValid: true, smtpValid: false };
    }
  }

  const smtpResult = await smtpVerify(normalized, mxRecords[0]);

  if (smtpResult.valid) {
    const isCatchAll = await verifyCatchAll(domain, mxRecords[0]);
    if (isCatchAll) {
      return { status: "invalid", reason: "catch_all_domain", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: true };
    }
    return { status: "valid", reason: "mailbox_exists", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: false };
  }

  if (smtpResult.reason === "mailbox_not_found" || smtpResult.reason === "mailbox_full_or_rejected") {
    return { status: "invalid", reason: smtpResult.reason, provider, format: true, mxValid: true, smtpValid: false };
  }

  if (smtpResult.reason === "greylisted") {
    return { status: "unknown", reason: "greylisted", provider, format: true, mxValid: true, smtpValid: false };
  }

  if (SMTP_UNREACHABLE_REASONS.has(smtpResult.reason)) {
    return { status: "valid", reason: "mx_valid_smtp_unreachable", provider, format: true, mxValid: true, smtpValid: false };
  }

  return { status: "valid", reason: `mx_valid_${smtpResult.reason}`, provider, format: true, mxValid: true, smtpValid: false };
}

export function canSendToLead(verificationStatus: string | null, enableRiskyEmails: boolean, disableBounceProtect: boolean): { allowed: boolean; reason: string } {
  if (!verificationStatus || verificationStatus === "unverified") {
    return { allowed: true, reason: "not_verified" };
  }
  if (verificationStatus === "valid") {
    return { allowed: true, reason: "valid" };
  }
  if (verificationStatus === "risky") {
    if (enableRiskyEmails) {
      return { allowed: true, reason: "risky_allowed_by_user" };
    }
    return { allowed: false, reason: "disposable_or_role_account" };
  }
  if (verificationStatus === "invalid") {
    return { allowed: false, reason: "invalid" };
  }
  if (verificationStatus === "unknown") {
    return { allowed: false, reason: "unknown" };
  }
  return { allowed: true, reason: "unknown_status" };
}
