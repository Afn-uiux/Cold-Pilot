import dns from "dns/promises";
import net from "net";
import tls from "tls";
import { assertSafeSocketTarget, isAllowedSocketPort } from "./ssrf";
import { isDisposable } from "./disposable";
import { isTyposquat } from "./typosquat";
import { probe550Verdict } from "./verify-providers";
import { checkGlobalIntel } from "./global-intel";
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

export type VerificationStatus = "valid" | "invalid" | "risky" | "unknown" | "catch_all";

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
  [/yahoo\.|yahooding|yahoodns\./i, "Yahoo"],
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
  [/163\.com/i, "163"],
  [/126\.com/i, "126"],
  [/web\.de/i, "Web.de"],
  [/t-online\./i, "T-Online"],
  [/freenet\.de/i, "Freenet"],
  [/free\.fr/i, "Free"],
  [/orange\.fr/i, "Orange"],
  [/laposte\.net/i, "La Poste"],
  [/sfr\.fr/i, "SFR"],
  [/qq\.com|exmail\.qq\./i, "QQ"],
  [/naver\./i, "Naver"],
  [/daum\./i, "Daum"],
  [/rediffmail\./i, "Rediffmail"],
  [/indiatimes\./i, "Indiatimes"],
  [/rambler\./i, "Rambler"],
  [/uol\.com\.br/i, "UOL"],
  [/bol\.com\.br/i, "BOL"],
  [/hey\.com/i, "Hey"],
  [/hushmail\./i, "Hushmail"],
  [/startmail\./i, "StartMail"],
  [/posteo\./i, "Posteo"],
  [/mailbox\.org/i, "Mailbox.org"],
  [/netzero\./i, "NetZero"],
  [/juno\.com/i, "Juno"],
  [/lycos\./i, "Lycos"],
  [/excite\./i, "Excite"],
  [/mailfence\./i, "Mailfence"],
  [/runbox\./i, "Runbox"],
  [/countermail\./i, "CounterMail"],
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

// Identity used for raw port-25 probes. This hostname MUST resolve (A record)
// to the probing server's IPv4 AND match its reverse DNS (PTR). Receivers
// reject or heavily penalize probes whose EHLO hostname doesn't resolve,
// and SPF on the MAIL FROM domain must authorize the probing IP.
const PROBE_HELO_HOST = "server.usecoldpilot.com";
const PROBE_MAIL_FROM = "verify@usecoldpilot.com";

function smtpVerify(email: string, mxHost: string): Promise<{ valid: boolean; catchAll: boolean; reason: string }> {
  return new Promise((resolve) => {
    // SSRF guard: the MX host comes from DNS MX records of a user-supplied
    // email domain, so it is attacker-influenced. Reject targets that resolve
    // to private/reserved/internal addresses before opening any socket.
    assertSafeSocketTarget(mxHost, 25).then((err) => {
      if (err) {
        resolve({ valid: false, catchAll: false, reason: "ssrf_blocked" });
        return;
      }
      openSmtpSocket(email, mxHost, resolve);
    }).catch(() => {
      resolve({ valid: false, catchAll: false, reason: "ssrf_blocked" });
    });
  });
}

function openSmtpSocket(email: string, mxHost: string, resolve: (v: { valid: boolean; catchAll: boolean; reason: string }) => void) {
    // Force IPv4: the server's IPv6 has no PTR, so v6 egress would present a
    // HELO/PTR mismatch and get penalized. The v4 address has matching
    // forward + reverse DNS (server.usecoldpilot.com <-> 40.160.88.93).
    const socket = net.createConnection({ host: mxHost, port: 25, family: 4 });
    let buffer = "";
    let resolved = false;
    let step = 0;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      // Be polite: a clean QUIT keeps us off "rude client" throttles that
      // penalize servers which connect, probe, and vanish without goodbye.
      try { socket.write("QUIT\r\n"); } catch {}
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
          socket.write(`EHLO ${PROBE_HELO_HOST}\r\n`);
        } else if (step === 1 && (code === 250 || code === 220)) {
          if (line.startsWith("250-")) continue;
          step = 2;
          socket.write(`MAIL FROM:<${PROBE_MAIL_FROM}>\r\n`);
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
}

function smtpVerifyViaAccount(targetEmail: string, config: SmtpConfig): Promise<{ valid: boolean; reason: string }> {
  return new Promise((resolve) => {
    // SSRF guard: config.host/port is user-supplied account SMTP config, which
    // an attacker could point at internal/metadata addresses. Validate both
    // the port allow-list and the resolved host before opening any socket.
    if (!isAllowedSocketPort(config.port)) {
      resolve({ valid: false, reason: "account_port_not_allowed" });
      return;
    }
    assertSafeSocketTarget(config.host, config.port).then((err) => {
      if (err) {
        resolve({ valid: false, reason: "account_ssrf_blocked" });
        return;
      }
      runAccountSmtp(targetEmail, config, resolve);
    }).catch(() => {
      resolve({ valid: false, reason: "account_ssrf_blocked" });
    });
  });
}

function runAccountSmtp(targetEmail: string, config: SmtpConfig, resolve: (v: { valid: boolean; reason: string }) => void) {
    const useTls = config.port === 465;
    let socket: net.Socket;
    let supportsStartTls = false;
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
      // Verify the peer certificate (rejectUnauthorized: true). SMTP account
      // credentials are sent via AUTH LOGIN later in this flow, so sending them
      // over an unverified TLS channel would let a MITM read them. On a failed
      // handshake the socket 'error' handler below resolves as inconclusive and
      // the credentials are never transmitted.
      socket = tls.connect({ host: config.host, port: config.port, rejectUnauthorized: true }, () => {
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
          socket.write(`EHLO ${PROBE_HELO_HOST}\r\n`);
        } else if (step === 1 && code === 250) {
          if (!useTls && /STARTTLS/i.test(line)) {
            supportsStartTls = true;
            step = 11;
            socket.write("STARTTLS\r\n");
            continue;
          }
          if (line.startsWith("250-")) continue;
          if (!useTls && !supportsStartTls) {
            // The server won't encrypt credentials (no implicit TLS on 465,
            // no STARTTLS offered). Sending AUTH LOGIN would expose them in
            // plaintext — refuse rather than leak the account password.
            clearTimeout(timeout);
            cleanup();
            socket.write("QUIT\r\n");
            resolve({ valid: false, reason: "account_refused_plaintext_auth" });
            return;
          }
          step = 2;
          socket.write(`AUTH LOGIN\r\n`);
        } else if (step === 11 && code === 220) {
          const secureSocket = tls.connect({ socket, rejectUnauthorized: true }, () => {
            step = 1;
            buffer = "";
            socket.write(`EHLO ${PROBE_HELO_HOST}\r\n`);
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

// How many total attempts (1 probe + retries) a mail server gets before we
// give up on it. Greylist/throttle replies come back fast, so retrying them
// is cheap; timeouts cost a full socket timeout each, so those retry once.
const SMTP_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Temp-failure codes where the server actively replied "try again later" —
// greylist (45x), too-many-connections / rate limit (421), and generic SMTP
// temp failures (450/451/452). A mailbox that definitively doesn't exist
// (550/551/553) is returned immediately; retrying it wastes a probe.
function isCodeBasedTemp(reason: string): boolean {
  if (reason === "greylisted") return true;
  return /_(421|450|451|452)$/.test(reason);
}

// Everything that is NOT a clean answer deserves a retry before we decide:
// the server is throttling us, greylisting us, or the probe itself died. None
// of these prove the mailbox is dead, so after retries they must still never
// be classified as "invalid" — they are soft "unknown" flags.
function isRetryableReason(reason: string): boolean {
  if (reason === "timeout" || reason === "connection_error" || reason === "connection_closed") return true;
  if (reason === "ssrf_blocked") return false;
  return isCodeBasedTemp(reason);
}

function retryBackoffMs(reason: string, attempt: number): number {
  if (reason === "greylisted") return 1500 * attempt;
  if (reason === "timeout" || reason === "connection_error" || reason === "connection_closed") return 800;
  return 600 * attempt;
}

// Try each MX in order until one gives a definitive answer, retrying temp
// failures (greylist/throttle/timeout) with a short backoff first. The first
// MX is sometimes slow, dead, or throttling probers while a secondary answers
// cleanly — failing the whole check on mx[0] alone caused false "unknown"s.
// A greylister that 45x's the first probe often accepts a polite follow-up a
// few seconds later, so "fail fast" was mislabeling throttled domains.
async function smtpVerifyWithMxFallback(
  email: string,
  mxRecords: string[],
): Promise<{ result: { valid: boolean; catchAll: boolean; reason: string }; mxHost: string }> {
  const hosts = mxRecords.slice(0, 3);
  let last = { valid: false, catchAll: false, reason: "mx_valid_smtp_unreachable" };
  let timeoutRetryBudget = 1;
  for (const mxHost of hosts) {
    for (let attempt = 1; attempt <= SMTP_MAX_ATTEMPTS; attempt++) {
      const r = await smtpVerify(email, mxHost);
      last = r;
      if (r.valid || !isRetryableReason(r.reason)) return { result: r, mxHost };
      if (isCodeBasedTemp(r.reason)) {
        if (attempt < SMTP_MAX_ATTEMPTS) await sleep(retryBackoffMs(r.reason, attempt));
      } else {
        // timeout / connection drop: retry at most once across all MX hosts —
        // hanging sockets are expensive, and the MX fallback already covers
        // a flaky primary.
        if (timeoutRetryBudget > 0) {
          timeoutRetryBudget--;
          await sleep(retryBackoffMs(r.reason, attempt));
        } else {
          break;
        }
      }
    }
  }
  return { result: last, mxHost: hosts[0] };
}

export async function verifyEmail(email: string, smtpConfig?: SmtpConfig): Promise<VerificationResult> {
  const normalized = email.toLowerCase().trim();

  if (!verifyFormat(normalized)) {
    return { status: "invalid", reason: "invalid_format", provider: "Unknown", format: false };
  }

  const domain = extractDomain(normalized);
  // Typosquat before disposable: lookalike domains (gmial.com, gmail.cmo)
  // are usually user typos of a real provider, and many sit on disposable
  // lists too. "You mistyped" (invalid) beats "throwaway" (risky) there —
  // sending to a typo can only bounce or hit a stranger.
  if (isTyposquat(domain)) {
    return { status: "invalid", reason: "typosquat_domain", provider: "Unknown", format: true };
  }

  if (isDisposable(domain)) {
    return { status: "risky", reason: "disposable_email", provider: "Unknown", format: true, disposable: true };
  }

  const local = extractLocal(normalized);
  if (ROLE_PREFIXES.includes(local)) {
    return { status: "risky", reason: "role_account", provider: "Unknown", format: true, roleAccount: true };
  }

  // Shared platform memory: if any user's definitive check already proved
  // this address dead, resolve instantly — no probe spent, no credit burned,
  // no reputation risked. The MX lookup below is DNS-only (no port 25) and
  // just labels the provider for display.
  const intel = await checkGlobalIntel(normalized);
  if (intel) {
    const { mxRecords } = await verifyMX(normalized);
    return {
      status: "invalid",
      reason: "known_bad_global",
      provider: mxRecords.length > 0 ? detectProvider(mxRecords) : "Unknown",
      format: true,
      mxValid: mxRecords.length > 0,
      smtpValid: false,
    };
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
    let accountResult = await smtpVerifyViaAccount(normalized, smtpConfig);

    // Greylisted = the account's own server said "try again". Retry once or
    // twice before labeling it unknown — throttles are often transient and a
    // greylisted mailbox usually verifies cleanly seconds later.
    for (let attempt = 2; accountResult.reason === "greylisted" && attempt <= SMTP_MAX_ATTEMPTS; attempt++) {
      await sleep(retryBackoffMs("greylisted", attempt - 1));
      accountResult = await smtpVerifyViaAccount(normalized, smtpConfig);
    }

    if (accountResult.valid) {
      const isCatchAll = await verifyCatchAll(domain, mxRecords[0]);
      if (isCatchAll) {
        return { status: "catch_all", reason: "catch_all_domain", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: true };
      }
      return { status: "valid", reason: "mailbox_exists", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: false };
    }

    // Hard invalid: the server explicitly confirmed the mailbox doesn't exist.
    if (accountResult.reason === "mailbox_not_found") {
      return { status: "invalid", reason: "mailbox_not_found", provider, format: true, mxValid: true, smtpValid: false };
    }

    // Soft / no clean answer (mailbox full or generic 55x, greylisted): not a
    // confirmed rejection, so flag it instead of blocking.
    if (accountResult.reason === "mailbox_full_or_rejected" || accountResult.reason === "greylisted") {
      return { status: "unknown", reason: accountResult.reason, provider, format: true, mxValid: true, smtpValid: false };
    }

    // Account auth/connection/misc failure — fall back to raw port 25 below.
  }

  // Raw port-25 probe with MX fallback. Probes run over IPv4 with an
  // EHLO hostname that matches our PTR, and MAIL FROM from a domain whose
  // SPF authorizes the probing IP — otherwise receivers greylist or reject
  // the probe itself. Temp failures (greylist/throttle/timeout) are retried
  // briefly before we call it, and only a definitive 550/551/553 mailbox
  // rejection can mark a lead "invalid".
  const { result: smtpResult, mxHost: workingMx } = await smtpVerifyWithMxFallback(normalized, mxRecords);

  if (smtpResult.valid) {
    const isCatchAll = await verifyCatchAll(domain, workingMx);
    if (isCatchAll) {
      // Accept-all domains (Gmail, Outlook, corporate catch-alls) confirm
      // nothing: the address may or may not exist. Marking these "invalid"
      // silently discarded every Gmail lead; marking "valid" would be a lie.
      // It's its own risk tier: allow the send but flag it for manual review.
      return { status: "catch_all", reason: "catch_all_domain", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: true };
    }
    return { status: "valid", reason: "mailbox_exists", provider, format: true, mxValid: true, smtpValid: true, isCatchAll: false };
  }

  // "Mailbox not found" over raw port 25 is a definitive reject ONLY on
  // providers that answer probes honestly. Gmail/Microsoft/Yahoo/AOL return a
  // synthetic 550 just to hang up on probers, no matter whether the mailbox
  // exists — so their 550 proves nothing. Degrade those to "unknown" instead
  // of silently discarding real leads; the bounce net catches the dead ones.
  if (smtpResult.reason === "mailbox_not_found") {
    return probe550Verdict(provider) === "unknown"
      ? { status: "unknown", reason: "provider_blocks_probing", provider, format: true, mxValid: true, smtpValid: false }
      : { status: "invalid", reason: "mailbox_not_found", provider, format: true, mxValid: true, smtpValid: false };
  }

  // Everything below is "no clean answer": mailbox full or generic 55x,
  // greylisting, timeouts, throttles, connection failures. None of these
  // prove the address is dead, so they get a soft "unknown" flag (sendable,
  // reviewable) rather than an "invalid" block — this is exactly where the
  // false positives hide.
  if (smtpResult.reason === "mailbox_full_or_rejected" || smtpResult.reason === "greylisted") {
    return { status: "unknown", reason: smtpResult.reason, provider, format: true, mxValid: true, smtpValid: false };
  }

  if (SMTP_UNREACHABLE_REASONS.has(smtpResult.reason) || smtpResult.reason === "mx_valid_smtp_unreachable") {
    return { status: "unknown", reason: "mx_valid_smtp_unreachable", provider, format: true, mxValid: true, smtpValid: false };
  }

  return { status: "unknown", reason: `mx_valid_${smtpResult.reason}`, provider, format: true, mxValid: true, smtpValid: false };
}

export function canSendToLead(verificationStatus: string | null, enableRiskyEmails: boolean, disableBounceProtect: boolean): { allowed: boolean; reason: string } {
  if (!verificationStatus || verificationStatus === "unverified") {
    return { allowed: true, reason: "not_verified" };
  }
  if (verificationStatus === "valid") {
    return { allowed: true, reason: "valid" };
  }
  if (verificationStatus === "unknown") {
    // Soft/unverifiable (timeout, greylist, throttle, mailbox full): no clean
    // answer, but nothing proved the address dead. Don't auto-block — flag it
    // so the user can decide (this is where the false positives hide).
    return { allowed: true, reason: "unknown_flagged" };
  }
  if (verificationStatus === "catch_all") {
    // Accept-all domain: can't confirm this specific mailbox. Allow sending
    // but flag for manual review rather than blocking outright.
    return { allowed: true, reason: "catch_all_flagged" };
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
  return { allowed: true, reason: "unknown_status" };
}
