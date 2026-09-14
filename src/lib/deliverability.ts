import dns from "dns/promises";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const AI_TIMEOUT = 15000;
const AI_MAX_RETRIES = 2;

const DNS_BLACKLISTS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "b.barracudacentral.org",
  "psbl.surriel.com",
];

const SPAMMY_WORDS = [
  "free", "act now", "limited time", "click here", "congratulations",
  "exclusive offer", "double your", "earn money", "buy now", "call now",
  "order now", "don't delete", "guaranteed", "urgent", "winner",
  "cash bonus", "no cost", "no obligation", "amazing", "fantastic",
  "incredible deal", "once in a lifetime", "click below", "100% free",
  "unlimited", "risk free", "promise you", "message contains",
  "special offer", "prize", "awarded", "dear winner",
];

const SUSPICIOUS_TLDS = [".xyz", ".top", ".work", ".date", ".win", ".bid", ".loan"];

async function checkDNSRecord(domain: string, type: string): Promise<string[]> {
  try {
    const records = await dns.resolve(domain, type as any);
    return Array.isArray(records) ? records.map(String) : [];
  } catch {
    return [];
  }
}

async function checkSPF(domain: string): Promise<{ pass: boolean; record: string }> {
  const txtRecords = await checkDNSRecord(domain, "TXT");
  const spfRecord = txtRecords.find(r => r.startsWith("v=spf1"));
  return { pass: !!spfRecord, record: spfRecord || "" };
}

async function checkDKIM(domain: string): Promise<{ pass: boolean; selectors: string[] }> {
  const commonSelectors = ["google", "dkim", "mail", "default", "selector1", "selector2"];
  const found: string[] = [];
  for (const selector of commonSelectors) {
    const records = await checkDNSRecord(`${selector}._domainkey.${domain}`, "TXT");
    if (records.length > 0) {
      found.push(selector);
    }
  }
  return { pass: found.length > 0, selectors: found };
}

async function checkDMARC(domain: string): Promise<{ pass: boolean; record: string; policy: string }> {
  const records = await checkDNSRecord(`_dmarc.${domain}`, "TXT");
  const dmarcRecord = records.find(r => r.startsWith("v=DMARC1"));
  if (!dmarcRecord) return { pass: false, record: "", policy: "none" };
  const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/);
  return { pass: true, record: dmarcRecord, policy: policyMatch ? policyMatch[1] : "none" };
}

async function checkBlacklists(domain: string, ip?: string): Promise<{ listed: boolean; lists: string[] }> {
  const listedOn: string[] = [];
  const ipsToCheck = ip ? [ip] : [];

  if (ipsToCheck.length === 0) {
    try {
      const addresses = await dns.resolve4(domain);
      ipsToCheck.push(...addresses);
    } catch {}
  }

  for (const ipAddr of ipsToCheck) {
    const reversed = ipAddr.split(".").reverse().join(".");
    for (const bl of DNS_BLACKLISTS) {
      try {
        await dns.resolve4(`${reversed}.${bl}`);
        listedOn.push(bl);
      } catch {}
    }
  }

  return { listed: listedOn.length > 0, lists: listedOn };
}

const AI_SPAM_PROMPT = `You are a senior email deliverability engineer. Analyze the following outbound email body and judge whether it would be flagged as spam by providers like Gmail / Outlook.

Return ONLY valid JSON, no prose, matching this shape:
{"score": <number 0-10>, "issues": ["<short reason>", ...]}

Score meaning:
- 10 = perfectly clean, natural human email.
- 0 = certain spam.
Consider: spam trigger words and phrases, salesy/hype language, urgency and pressure, excessive links, link shorteners, ALL-CAPS words, excessive exclamation marks, sneaky phrasing like "don't delete", promises/guarantees, financial or "act now" pressure, a body that reads like a template or ad rather than a human message. Deduct 0.5 to 2 per issue found.
List every deduction as a short specific issue.

EMAIL BODY:
{{{BODY}}}`;

export async function aiScoreContent(bodyHtml: string): Promise<{ score: number; issues: string[] } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const body = (bodyHtml || "").slice(0, 4000);
  const prompt = AI_SPAM_PROMPT.replace("{{{BODY}}}", body);

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
      const res = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          max_tokens: 400,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (attempt < AI_MAX_RETRIES && res.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        return null;
      }

      const data = await res.json();
      const raw: string = data.choices?.[0]?.message?.content || "";
      let cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const score = typeof parsed.score === "number" ? Math.max(0, Math.min(10, parsed.score)) : null;
      if (score === null) return null;
      const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String) : [];
      return { score, issues };
    } catch {
      if (attempt < AI_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function scoreContent(bodyHtml: string): { score: number; issues: string[] } {
  const body = (bodyHtml || "").toLowerCase();
  const issues: string[] = [];
  let deductions = 0;

  const spammyFound = SPAMMY_WORDS.filter(w => body.includes(w));
  if (spammyFound.length > 0) {
    deductions += Math.min(spammyFound.length * 0.5, 2);
    issues.push(`Spammy words found: ${spammyFound.slice(0, 5).join(", ")}`);
  }

  const linkCount = (body.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) {
    deductions += 1;
    issues.push(`${linkCount} links — high link density`);
  }

  const exclaimCount = (body.match(/!/g) || []).length;
  if (exclaimCount > 5) {
    deductions += 0.5;
    issues.push(`Excessive exclamation marks (${exclaimCount})`);
  }

  const capsWords = (body.match(/\b[A-Z]{4,}\b/g) || []).length;
  if (capsWords > 5) {
    deductions += 0.5;
    issues.push(`Excessive ALL CAPS words (${capsWords})`);
  }

  const textLength = body.replace(/<[^>]*>/g, "").trim().length;
  if (textLength < 50) {
    deductions += 0.5;
    issues.push("Very short email body");
  }

  const suspiciousTldFound = SUSPICIOUS_TLDS.some(tld => body.includes(tld));
  if (suspiciousTldFound) {
    deductions += 1;
    issues.push("Contains suspicious TLD links");
  }

  return { score: Math.max(0, 10 - deductions), issues };
}

export interface DeliverabilityResult {
  overallScore: number;
  breakdown: {
    spf: { pass: boolean; record: string };
    dkim: { pass: boolean; selectors: string[] };
    dmarc: { pass: boolean; record: string; policy: string };
    blacklists: { listed: boolean; lists: string[] };
    content: { score: number; issues: string[] };
  };
}

export async function checkDeliverability(domain: string, bodyHtml?: string): Promise<DeliverabilityResult> {
  const [spf, dkim, dmarc, blacklists] = await Promise.all([
    checkSPF(domain),
    checkDKIM(domain),
    checkDMARC(domain),
    checkBlacklists(domain),
  ]);

  const aiContent = await aiScoreContent(bodyHtml || "");
  const content = aiContent ?? scoreContent(bodyHtml || "");

  let score = 10;

  if (!spf.pass) score -= 1.5;
  if (!dkim.pass) score -= 1;
  if (!dmarc.pass) score -= 0.5;
  else if (dmarc.policy === "none") score -= 0.5;

  if (blacklists.listed) score -= 2;

  score = Math.round((score + content.score) / 2 * 10) / 10;

  return {
    overallScore: Math.max(0, Math.min(10, Math.round(score))),
    breakdown: { spf, dkim, dmarc, blacklists, content },
  };
}
