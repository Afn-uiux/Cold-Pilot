export function processSpintax(text: string): string {
  // Matches {{RANDOM | option1 | option2 | option3}} and picks one at random
  let result = text.replace(/\{\{RANDOM\s*\|\s*([^}]+)\}\}/gi, (_match, group) => {
    const options = group.split("|").map((s: string) => s.trim());
    return options[Math.floor(Math.random() * options.length)];
  });
  // Matches {option1|option2|option3} and picks one at random
  result = result.replace(/\{([^{}]+)\}/g, (_match, group) => {
    const options = group.split("|").map((s: string) => s.trim());
    return options[Math.floor(Math.random() * options.length)];
  });
  return result;
}

export function personalizeText(text: string, variables: Record<string, string>): string {
  let result = text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key.toLowerCase()];
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
    .replace(/\{\{accountSignature\}\}/g, "Best regards,\nYour Name");
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
