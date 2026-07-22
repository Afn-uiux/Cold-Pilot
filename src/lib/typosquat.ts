const LEGITIMATE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "windowslive.com",
  "aol.com", "aim.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "protonmail.ch",
  "zoho.com", "zohomail.com",
  "gmx.com", "gmx.net", "gmx.de",
  "mail.com", "email.com",
  "yandex.com", "yandex.ru", "ya.ru",
  "fastmail.com", "fastmail.fm",
  "tutanota.com", "tutamail.com", "tuta.io",
  "mail.ru", "inbox.ru", "list.ru",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net",
  "cox.net", "charter.net", "rr.com",
  "163.com", "126.com", "qq.com",
]);

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function generateTypos(domain: string): Set<string> {
  const typos = new Set<string>();
  const parts = domain.split(".");
  if (parts.length < 2) return typos;
  const name = parts.slice(0, -1).join(".");
  const tld = parts[parts.length - 1];

  // Wrong TLD typos
  const wrongTlds = ["cmo", "cno", "om", "ocm", "con", "cpm", "conm", "com.", "co", "cm"];
  for (const wrong of wrongTlds) {
    typos.add(`${name}.${wrong}`);
  }

  // Character swap (adjacent)
  for (let i = 0; i < name.length - 1; i++) {
    const swapped = name.substring(0, i) + name[i + 1] + name[i] + name.substring(i + 2);
    typos.add(`${swapped}.${tld}`);
  }

  // Missing character
  for (let i = 0; i < name.length; i++) {
    const missing = name.substring(0, i) + name.substring(i + 1);
    if (missing.length > 1) typos.add(`${missing}.${tld}`);
  }

  // Double character
  for (let i = 0; i <= name.length; i++) {
    const doubled = name.substring(0, i) + name[i < name.length ? i : name.length - 1] + name.substring(i);
    typos.add(`${doubled}.${tld}`);
  }

  // Levenshtein distance 1
  const commonPrefixes = ["gmaill", "gamil", "gmal", "gnail", "gmailo", "hotmal", "hotmai", "outlok", "outloo", "yaho"];
  for (const prefix of commonPrefixes) {
    if (levenshtein(name, prefix) <= 1) {
      typos.add(`${prefix}.${tld}`);
    }
  }

  return typos;
}

const TYPOSQUAT_DOMAINS = new Set<string>();

const providersToCheck = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com",
  "aol.com", "icloud.com", "protonmail.com", "zoho.com", "gmx.com",
  "mail.com", "yandex.com", "fastmail.com", "tutanota.com", "mail.ru",
  "comcast.net", "verizon.net", "att.net", "qq.com", "163.com",
];

for (const domain of providersToCheck) {
  for (const typo of generateTypos(domain)) {
    TYPOSQUAT_DOMAINS.add(typo);
  }
}

// Hand-picked known typosquats
const MANUAL_ADDITIONS = [
  "gamil.com", "gmil.com", "gmaill.com", "gmail.co", "gmail.com.",
  "gnail.com", "gmai.com", "gmail.cm", "gmail.cmo",
  "hotmal.com", "hotmai.com", "hotmial.com", "hotmail.cm", "hotmail.cmo",
  "outlok.com", "outloo.com", "outlook.cmo", "outlook.cm",
  "yahoo.co", "yahoo.cm", "yahoo.cmo", "yaho.com",
  "aol.cm", "aol.cmo",
  "icloud.cm", "icloud.cmo",
  "protonmail.cm", "protonmail.cmo",
  "zoho.cm", "zoho.cmo",
  "gmx.cm", "gmx.cmo",
  "mail.cm", "mail.cmo",
  "fastmail.cm", "fastmail.cmo",
  "tutanota.cm", "tutanota.cmo",
  "qq.cm", "qq.cmo",
  "163.cm", "163.cmo",
  "live.cm", "live.cmo",
  "msn.cm", "msn.cmo",
  "aim.cm", "aim.cmo",
  "ymail.cm", "ymail.cmo",
  "rocketmail.cm", "rocketmail.cmo",
  "comcast.cm", "comcast.cmo",
  "verizon.cm", "verizon.cmo",
  "att.cm", "att.cmo",
];

for (const d of MANUAL_ADDITIONS) {
  TYPOSQUAT_DOMAINS.add(d);
}

export function isTyposquat(domain: string): boolean {
  const lower = domain.toLowerCase();
  if (LEGITIMATE_DOMAINS.has(lower)) return false;
  if (TYPOSQUAT_DOMAINS.has(lower)) return true;
  for (const legit of LEGITIMATE_DOMAINS) {
    if (levenshtein(lower, legit) === 1) return true;
  }
  return false;
}

export function getTyposquatDomains(): string[] {
  return Array.from(TYPOSQUAT_DOMAINS);
}
