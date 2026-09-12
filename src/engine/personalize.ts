function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(options: string[], rnd: () => number): string {
  return options[Math.floor(rnd() * options.length)];
}

function resolveGroup(group: string, rnd: () => number): string {
  const options = group.split("|").map((s: string) => s.trim());
  const weighted = options.every(o => /^\d+[%:]/.test(o));
  if (weighted) {
    const totalWeight = options.reduce((sum, o) => {
      const m = o.match(/^(\d+)[%:]/);
      return sum + (m ? parseInt(m[1]) : 0);
    }, 0);
    let roll = rnd() * totalWeight;
    for (const o of options) {
      const m = o.match(/^(\d+)[%:]\s*(.*)/);
      if (m) {
        roll -= parseInt(m[1]);
        if (roll <= 0) return m[2];
      }
    }
    return options[options.length - 1].replace(/^\d+[%:]\s*/, "");
  }
  return pickRandom(options, rnd);
}

function resolveSpintax(text: string, rnd: () => number): string {
  // Recursively resolve innermost groups first so nested spintax works.
  // e.g. "Hey {Hi {there|friend}|Hello}" → "Hey Hi there" or "Hey Hi friend" or "Hey Hello"
  let prev = text;
  let result = text;
  for (let i = 0; i < 10; i++) {
    result = result.replace(/\{([^{}]*)\}/g, (_match, group) => {
      return resolveGroup(group, rnd);
    });
    if (result === prev) break;
    prev = result;
  }
  return result;
}

export function processSpintax(text: string, seed?: number): string {
  const rnd: () => number = seed === undefined || seed === null ? Math.random : mulberry32(seed);
  // {{RANDOM | option1 | option2 | option3}} — explicit random syntax
  let result = text.replace(/\{\{RANDOM\s*\|\s*([^}]+)\}\}/gi, (_match, group) => {
    const options = group.split("|").map((s: string) => s.trim());
    return pickRandom(options, rnd);
  });
  // Protect any leftover {{variable}} tags so the {...} resolver below can't eat them
  const placeholders: string[] = [];
  result = result.replace(/\{\{\w+\}\}/g, (match) => {
    placeholders.push(match);
    return `\u0001${placeholders.length - 1}\u0001`;
  });
  // All {...} groups — weighted, flat, or nested (resolved innermost-first)
  result = resolveSpintax(result, rnd);
  // Restore protected variable tags
  result = result.replace(/\u0001(\d+)\u0001/g, (_match, i) => placeholders[parseInt(i, 10)] ?? "");
  return result;
}

export function previewFillVariables(
  text: string,
  overrides: Record<string, string>,
  lead: Record<string, string | null | undefined> | null
): string {
  let result = text || "";

  const knownLower: Record<string, string> = {};
  for (const [k, v] of Object.entries({
    firstName: "John", lastName: "Doe", company: "Acme Inc", companyName: "Acme Inc",
    title: "CEO", email: "john@acme.com", phone: "(555) 123-4567",
    personalization: "loved your recent post", website: "acme.com",
    location: "San Francisco, CA", signature: "Best regards,\nYour Name",
    accountSignature: "Best regards,\nYour Name",
  })) knownLower[k.toLowerCase()] = v;

  const leadVars: Record<string, string> = {};
  if (lead) {
    const map: Record<string, string> = {
      firstName: lead.firstName || "", lastName: lead.lastName || "",
      company: lead.company || "", companyName: lead.company || "",
      title: lead.title || "",
      email: lead.email || "", phone: lead.phone || "",
      website: lead.website || "", location: lead.location || "",
      personalization: lead.personalization || "",
    };
    for (const [k, v] of Object.entries(map)) leadVars[k.toLowerCase()] = v;
    if (typeof lead.customFields === "string" && lead.customFields) {
      try {
        const cf = JSON.parse(lead.customFields) as Record<string, string>;
        for (const [k, v] of Object.entries(cf)) {
          if (typeof v === "string" && v) leadVars[k.toLowerCase()] = v;
        }
      } catch {
        // ignore malformed customFields
      }
    }
  }

  // The modal's overrides are keyed by display name ("companyName"),
  // tag lookups are lowercase ("companyname"), and the backend aliases
  // some display vars ("companyName" → "company", "accountSignature" →
  // "signature"). Normalize all three so the preview fills like a real send.
  const ovLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === "string" && v.trim()) ovLower[k.toLowerCase()] = v.trim();
  }
  const aliasOf: Record<string, string> = {};
  for (const [display, backend] of Object.entries(VARIABLE_ALIASES)) {
    const dl = display.toLowerCase();
    const bl = backend.toLowerCase();
    aliasOf[dl] = bl;
    aliasOf[bl] = dl;
  }

  const demoValue = (key: string): string => {
    const map: Record<string, string> = {
      name: "John Doe",
      service: "your service",
      city: "your city",
      business: "your business",
      industry: "your industry",
      date: "Monday",
      day: "Monday",
      role: "your role",
      partner: "your partner",
      manager: "your manager",
      count: "10",
      budget: "your budget",
      goal: "your goal",
      challenge: "your challenge",
      source: "your source",
      site: "your website",
      url: "your url",
    };
    return map[key.toLowerCase()] ?? "your " + key.toLowerCase();
  };

  // Collect every tag actually used in the text (both {{...}} and ((...)))
  const vars: Record<string, string> = {};
  const usedKeys = new Set<string>();
  const tagRe = /\{\{([^{}()|]+?)\}\}|\(\(([^{}()|]+?)\)\)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(result)) !== null) {
    const key = (m[1] || m[2] || "").trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (lower === "random") continue;
    usedKeys.add(lower);
  }

  for (const key of usedKeys) {
    let val = ovLower[key];
    if (!val) {
      const alias = aliasOf[key];
      val = alias ? ovLower[alias] : "";
    }
    if (!val && lead) val = leadVars[key] || "";
    if (!val && lead) {
      const alias = aliasOf[key];
      if (alias) val = leadVars[alias] || "";
    }
    if (!val) val = knownLower[key] ?? demoValue(key);
    vars[key] = val;
  }

  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    const re2 = new RegExp(`\\(\\(${key}\\)\\)`, "gi");
    result = result.replace(re, val).replace(re2, val);
  }

  return processSpintax(result);
}

export function personalizeText(text: string, variables: Record<string, string>, seed?: number): string {
  const lowerVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    lowerVars[k.toLowerCase()] = v;
  }
  let result = text.replace(/\{\{([^{}|]+)\}\}/g, (match, key) => {
    const value = lowerVars[key.trim().toLowerCase()];
    return value || match;
  });
  result = result.replace(/\(\(([^()|]+)\)\)/g, (match, key) => {
    const value = lowerVars[key.trim().toLowerCase()];
    return value || match;
  });
  result = processSpintax(result, seed);
  return result;
}

// Map display variable keys to their backend equivalents for campaign.ts lookups
export const VARIABLE_ALIASES: Record<string, string> = {
  companyName: "company",
  accountSignature: "signature",
  personalization: "personalization",
  website: "website",
  title: "title",
  phone: "phone",
  location: "location",
};

export function getPersonalizedPreview(text: string): string {
  const preview = text
    .replace(/\{\{firstName\}\}/g, "John")
    .replace(/\{\{lastName\}\}/g, "Doe")
    .replace(/\{\{company\}\}/g, "Acme Inc")
    .replace(/\{\{companyName\}\}/g, "Acme Inc")
    .replace(/\{\{title\}\}/g, "CEO")
    .replace(/\{\{email\}\}/g, "john@acme.com")
    .replace(/\{\{phone\}\}/g, "(555) 123-4567")
    .replace(/\{\{personalization\}\}/g, "loved your recent post about AI")
    .replace(/\{\{website\}\}/g, "acme.com")
    .replace(/\{\{location\}\}/g, "San Francisco, CA")
    .replace(/\{\{signature\}\}/g, "Best regards,\nYour Name")
    .replace(/\{\{accountSignature\}\}/g, "Best regards,\nYour Name")
    .replace(/\(\(firstName\)\)/g, "John")
    .replace(/\(\(lastName\)\)/g, "Doe")
    .replace(/\(\(company\)\)/g, "Acme Inc")
    .replace(/\(\(companyName\)\)/g, "Acme Inc")
    .replace(/\(\(title\)\)/g, "CEO")
    .replace(/\(\(email\)\)/g, "john@acme.com")
    .replace(/\(\(phone\)\)/g, "(555) 123-4567")
    .replace(/\(\(personalization\)\)/g, "loved your recent post about AI")
    .replace(/\(\(website\)\)/g, "acme.com")
    .replace(/\(\(location\)\)/g, "San Francisco, CA")
    .replace(/\(\(signature\)\)/g, "Best regards,\nYour Name")
    .replace(/\(\(accountSignature\)\)/g, "Best regards,\nYour Name");
  return processSpintax(preview);
}

export const VARIABLE_LIST = [
  { key: "firstName", label: "First Name", tag: "{{firstName}}" },
  { key: "lastName", label: "Last Name", tag: "{{lastName}}" },
  { key: "companyName", label: "Company Name", tag: "{{companyName}}" },
  { key: "title", label: "Title", tag: "{{title}}" },
  { key: "phone", label: "Phone", tag: "{{phone}}" },
  { key: "website", label: "Website", tag: "{{website}}" },
  { key: "location", label: "Location", tag: "{{location}}" },
  { key: "personalization", label: "Personalization", tag: "{{personalization}}" },
  { key: "accountSignature", label: "Signature", tag: "{{accountSignature}}" },
];
