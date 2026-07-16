function pickRandom(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

function resolveGroup(group: string): string {
  const options = group.split("|").map((s: string) => s.trim());
  const weighted = options.every(o => /^\d+[%:]/.test(o));
  if (weighted) {
    const totalWeight = options.reduce((sum, o) => {
      const m = o.match(/^(\d+)[%:]/);
      return sum + (m ? parseInt(m[1]) : 0);
    }, 0);
    let roll = Math.random() * totalWeight;
    for (const o of options) {
      const m = o.match(/^(\d+)[%:]\s*(.*)/);
      if (m) {
        roll -= parseInt(m[1]);
        if (roll <= 0) return m[2];
      }
    }
    return options[options.length - 1].replace(/^\d+[%:]\s*/, "");
  }
  return pickRandom(options);
}

function resolveSpintax(text: string): string {
  // Recursively resolve innermost groups first so nested spintax works.
  // e.g. "Hey {Hi {there|friend}|Hello}" → "Hey Hi there" or "Hey Hi friend" or "Hey Hello"
  let prev = text;
  let result = text;
  for (let i = 0; i < 10; i++) {
    result = result.replace(/\{([^{}]*)\}/g, (_match, group) => {
      return resolveGroup(group);
    });
    if (result === prev) break;
    prev = result;
  }
  return result;
}

export function processSpintax(text: string): string {
  // {{RANDOM | option1 | option2 | option3}} — explicit random syntax
  let result = text.replace(/\{\{RANDOM\s*\|\s*([^}]+)\}\}/gi, (_match, group) => {
    const options = group.split("|").map((s: string) => s.trim());
    return pickRandom(options);
  });
  // All {...} groups — weighted, flat, or nested (resolved innermost-first)
  result = resolveSpintax(result);
  return result;
}

export function personalizeText(text: string, variables: Record<string, string>): string {
  const lowerVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    lowerVars[k.toLowerCase()] = v;
  }
  let result = text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = lowerVars[key.toLowerCase()];
    return value || match;
  });
  result = result.replace(/\(\((\w+)\)\)/g, (match, key) => {
    const value = lowerVars[key.toLowerCase()];
    return value || match;
  });
  result = processSpintax(result);
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
