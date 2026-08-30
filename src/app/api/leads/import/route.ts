export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { trialGuard } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmailSafe } from "@/lib/email/send";
import { assertLeadCapacity, PlanLimitError, spendCredits, InsufficientCreditsError } from "@/lib/credits";
import { assertPublicHttpsUrl } from "@/lib/ssrf-guard";
import { CREDIT_COSTS } from "@/lib/plans";

const KNOWN_FIELDS = [
  "email", "e-mail", "email address", "mail", "emails", "email addresses", "e mail", "e_mail",
  "first name", "firstname", "first_name", "fname", "first", "given name", "given-name",
  "last name", "lastname", "last_name", "lname", "surname", "family name", "family_name", "familyname", "second name", "last-name",
  "company", "organization", "org", "business", "firm", "company name", "company_name", "company-name", "business name", "business_name", "employer", "co", "organisation", "account",
  "title", "job title", "position", "role", "designation", "job position", "job_position", "job-title", "job role", "job_role", "position title", "position_title",
  "phone", "telephone", "tel", "mobile", "cell", "phone number", "phone_number", "contact number", "contact_number", "phone #", "phone#", "phone no", "phone_no", "phone no.", "mobile phone", "mobile_number", "work phone", "work_phone", "cell phone", "cellphone",
  "website", "web", "url", "site", "company website", "company_website", "web site", "website url", "website_url", "linkedin url", "linkedin_url", "linkedin", "company site", "company_site", "webpage", "web page", "web page url",
  "personalization", "custom", "personalized", "custom field", "custom_field", "custom1", "custom2", "custom field 1", "personalize", "personalisation", "note personalization", "personalized note", "custom note", "personal note", "personal_note", "custom text", "notes_personalization",
  "location", "loc", "office location", "work location", "address", "mailing address", "street address", "place",
  "city", "town", "municipality", "locality", "city/town", "city town",
  "state", "province", "territory", "prefecture", "county", "state/province", "state province",
  "country", "nation", "country/region", "country region",
  "notes", "note", "comments", "description", "additional notes", "additional_info", "extra notes", "remarks", "extra info", "extra_information",
  "name",
];

function isKnownField(header: string): boolean {
  const clean = header.replace(/\s+/g, "").replace(/[_-]/g, "").replace(/[.]/g, "").toLowerCase();
  return KNOWN_FIELDS.some(kw => {
    const k = clean.replace(/\s+/g, "").replace(/[_-]/g, "").replace(/[.]/g, "").toLowerCase();
    if (k.length < 4) return clean === k;
    return clean === k || clean.includes(k) || k.includes(clean);
  });
}

function isNameGroupField(header: string): boolean {
  const clean = header.replace(/[^\w\s]/g, "").replace(/\s+/g, "").replace(/[._/-]/g, "").toLowerCase();
  const nameGroups = [
    ["city", "town", "municipality", "locality", "city/town", "city town"],
    ["state", "province", "territory", "prefecture", "county", "state/province", "state province"],
    ["country", "nation", "country/region", "country region"],
  ];
  return nameGroups.some(group => group.some(n => {
    const target = n.replace(/[^\w]/g, "").toLowerCase();
    if (target.length < 3) return clean === target;
    return clean === target || clean.includes(target) || target.includes(clean);
  }));
}

// A value that starts with a spreadsheet-formula prefix would be executed as a
// formula if the data is ever exported to CSV/XLSX and opened in Excel/Sheets.
// Prefixing a leading apostrophe neutralises that (classic CSV-injection defense).
const MAX_CUSTOM_FIELD_LEN = 1000;
function escapeCsvFormula(value: string): string {
  if (/^[=+\-@]/.test(value) || /^\t/.test(value) || /^\r/.test(value)) {
    return "'" + value;
  }
  return value;
}

function extractCustomFields(headers: string[], cols: string[]): Record<string, string> | null {
  const custom: Record<string, string> = {};
  let hasCustom = false;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    let val = cols[i]?.trim();
    if (!val) continue;
    if (val.length > MAX_CUSTOM_FIELD_LEN) val = val.slice(0, MAX_CUSTOM_FIELD_LEN);
    custom[h] = escapeCsvFormula(val);
    hasCustom = true;
  }
  return hasCustom ? custom : null;
}

function splitCsvLines(text: string, delimiter: string = ","): string[] {
  const lines: string[] = [];
  let current = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { current += '"'; i++; }
    else if (char === '"') { quoted = !quoted; current += char; }
    else if ((char === "\r" || char === "\n") && !quoted) {
      if (current.trim()) lines.push(current);
      current = "";
      if (char === "\r" && next === "\n") i++;
    } else { current += char; }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseCsvLine(line: string, delimiter: string = ","): string[] {
  const cells: string[] = [];
  let current = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i], next = line[i + 1];
    if (char === '"' && quoted && next === '"') { current += '"'; i++; }
    else if (char === '"') { quoted = !quoted; }
    else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ""; }
    else { current += char; }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

function findColumn(headers: string[], ...keywords: string[]): number {
  const clean = (s: string) => s.replace(/\s+/g, "").replace(/[_-]/g, "").replace(/[.]/g, "").toLowerCase();
  for (const kw of keywords) {
    const idx = headers.indexOf(kw.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < headers.length; i++) {
    const n = clean(headers[i]);
    if (keywords.some(kw => {
      if (kw.length < 4) return n === clean(kw);
      const k = clean(kw);
      return n === k || n.includes(k) || k.includes(n);
    })) return i;
  }
  return -1;
}

function findLocation(headers: string[], row: string[]): string | null {
  const direct = findHeader(headers, row,
    "location", "loc", "office location", "work location",
    "address", "mailing address", "street address", "place"
  );
  if (direct) return direct;
  const parts: string[] = [];
  const groups = [
    ["city", "town", "municipality", "locality", "city/town", "city town"],
    ["state", "province", "territory", "prefecture", "county", "state/province", "state province"],
    ["country", "nation", "country/region", "country region"],
  ];
  for (const group of groups) {
    const val = findHeader(headers, row, ...group);
    if (val) parts.push(val);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function findExact(headers: string[], row: string[], ...names: string[]): string | null {
  for (let i = 0; i < headers.length; i++) {
    if (names.some(n => headers[i].toLowerCase() === n.toLowerCase()) && row[i]?.trim()) {
      return row[i].trim();
    }
  }
  return null;
}

function findHeader(headers: string[], row: string[], ...names: string[]): string | null {
  const clean = (s: string) => s.replace(/[^\w\s]/g, "").replace(/\s+/g, "").replace(/[._/-]/g, "").toLowerCase();
  const normalized = headers.map(h => clean(h));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < headers.length; i++) {
      const h = pass === 0 ? headers[i].toLowerCase() : normalized[i];
      const match = names.some(n => {
        if (pass === 0) return h === n.toLowerCase() || h.replace(/[^a-z0-9]/g, "") === n.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = clean(n);
        if (target.length < 3) return h === target;
        return h === target || h.includes(target) || target.includes(h);
      });
      if (match && row[i]?.trim()) return row[i].trim();
    }
  }
  return null;
}

function mapRowToLead(loweredHeaders: string[], cols: string[], originalHeaders?: string[], emailIdx?: number) {
  const displayHeaders = originalHeaders || loweredHeaders;
  const customFields = extractCustomFields(displayHeaders, cols);
  return {
    email: (emailIdx !== undefined && emailIdx >= 0 ? cols[emailIdx] : cols[findColumn(loweredHeaders, "email", "e-mail", "email address", "mail", "emails", "email addresses", "e mail", "e_mail")]) || "",
    firstName: findHeader(loweredHeaders, cols,
      "first name", "firstname", "first_name", "fname", "first",
      "given name", "full name", "fullname", "forename", "given-name"
    ) || findExact(loweredHeaders, cols, "name"),
    lastName: findHeader(loweredHeaders, cols,
      "last name", "lastname", "last_name", "lname", "surname",
      "last", "family name", "family_name", "familyname", "second name",
      "last-name"
    ),
    company: findHeader(loweredHeaders, cols,
      "company", "organization", "org", "business", "firm",
      "company name", "company_name", "company-name", "business name",
      "business_name", "employer", "co", "organisation", "account"
    ),
    title: findHeader(loweredHeaders, cols,
      "title", "job title", "position", "role", "designation",
      "job position", "job_position", "job-title", "job role",
      "job_role", "position title", "position_title"
    ),
    phone: findHeader(loweredHeaders, cols,
      "phone", "telephone", "tel", "mobile", "cell",
      "phone number", "phone_number", "contact number", "contact_number",
      "phone #", "phone#", "phone no", "phone_no", "phone no.",
      "mobile phone", "mobile_number", "work phone", "work_phone",
      "cell phone", "cellphone"
    ),
    website: findHeader(loweredHeaders, cols,
      "website", "web", "url", "site", "company website",
      "company_website", "web site", "website url", "website_url",
      "linkedin url", "linkedin_url", "linkedin", "company site",
      "company_site", "webpage", "web page", "web page url"
    ),
    personalization: findHeader(loweredHeaders, cols,
      "personalization", "custom", "personalized", "custom field",
      "custom_field", "custom1", "custom2", "custom field 1",
      "personalize", "personalisation", "note personalization",
      "personalized note", "custom note", "personal note",
      "personal_note", "custom text", "notes_personalization"
    ),
    location: findLocation(loweredHeaders, cols),
    notes: findHeader(loweredHeaders, cols,
      "notes", "note", "comments", "description",
      "additional notes", "additional_info", "extra notes",
      "remarks", "extra info", "extra_information"
    ),
    customFields: customFields ? JSON.stringify(customFields) : null,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    const blocked = await trialGuard(session.user.id);
    if (blocked) return blocked;
  }
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const contentType = req.headers.get("content-type") || "";

  // JSON import (from link / paste / bulk)
  if (contentType.includes("application/json")) {
    const body = await req.json();
    let leads = body.leads;
    let campaignId: string | null = body.campaignId || null;
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { userId: true } });
      if (!campaign || campaign.userId !== userId) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }
    let rowsSkippedNoEmail = 0;

    // Fetch from URL
    if (body.url) {
      try {
        let url = body.url.trim();

        // Google Sheets: try multiple export formats for public sheets
        const gsMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (gsMatch) {
          const sheetId = gsMatch[1];
          const exportUrls = [
            `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`,
            `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
            `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`,
          ];
          let csvText = "";
          for (const exportUrl of exportUrls) {
            try {
              const r = await fetch(exportUrl, {
                redirect: "follow",
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  "Accept": "text/csv, text/plain, */*",
                },
                signal: AbortSignal.timeout(30000),
              });
              if (!r.ok) continue;
              const text = await r.text();
              if (text.trimStart().startsWith("<!")) continue;
              csvText = text;
              break;
            } catch { /* try next */ }
          }
          if (!csvText) {
            return NextResponse.json({
              error: "Could not read the Google Sheet. Make sure the sheet is set to 'Anyone with the link' can view, then try again.",
            }, { status: 400 });
          }
          const firstLineGuess = csvText.split(/\r?\n/)[0] || "";
          const delimGuess = detectDelimiter(firstLineGuess);
          const lines = splitCsvLines(csvText, delimGuess);
          if (lines.length < 2) return NextResponse.json({ error: "Sheet has no data rows" }, { status: 400 });
          const delim = detectDelimiter(lines[0]);
          const originalHeaders = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim());
          const headers = originalHeaders.map(h => h.toLowerCase());
          const emailIdx = findColumn(headers,
            "email", "e-mail", "email address", "mail",
            "emails", "email addresses", "e mail", "e_mail"
          );
          if (emailIdx === -1) return NextResponse.json({ error: "No 'email' column found in the sheet", headers: originalHeaders }, { status: 400 });
          const allRows = lines.slice(1).map(line => {
            const cols = parseCsvLine(line, delim);
            return mapRowToLead(headers, cols, originalHeaders, emailIdx);
          });
          rowsSkippedNoEmail = allRows.filter(l => !l.email || !l.email.includes("@")).length;
          leads = allRows.filter(l => l.email && l.email.includes("@"));
        } else {
          let parsed: URL;
          try {
            parsed = await assertPublicHttpsUrl(url);
          } catch (err) {
            return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid URL" }, { status: 400 });
          }
          const res = await fetch(parsed, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(30000),
          });
          if (!res.ok) return NextResponse.json({ error: `Server returned ${res.status}. Make sure the link is a public CSV file.` }, { status: 400 });
          const text = await res.text();
          const firstLineGuess2 = text.split(/\r?\n/)[0] || "";
          const delimGuess2 = detectDelimiter(firstLineGuess2);
          const lines = splitCsvLines(text, delimGuess2);
          if (lines.length < 2) return NextResponse.json({ error: "No data rows found in the file" }, { status: 400 });
          const delim = detectDelimiter(lines[0]);
          const originalHeaders2 = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim());
          const headers = originalHeaders2.map(h => h.toLowerCase());
          const emailIdx = findColumn(headers,
            "email", "e-mail", "email address", "mail",
            "emails", "email addresses", "e mail", "e_mail"
          );
          if (emailIdx === -1) return NextResponse.json({ error: "No 'email' column found", headers: originalHeaders2 }, { status: 400 });
          const allRows = lines.slice(1).map(line => {
            const cols = parseCsvLine(line, delim);
            return mapRowToLead(headers, cols, originalHeaders2, emailIdx);
          });
          rowsSkippedNoEmail = allRows.filter(l => !l.email || !l.email.includes("@")).length;
          leads = allRows.filter(l => l.email && l.email.includes("@"));
        }
      } catch (err: any) {
        console.error("Failed to fetch import file:", err);
        return NextResponse.json({ error: "Failed to fetch the file. Make sure the URL is publicly accessible." }, { status: 400 });
      }
    }

    if (!Array.isArray(leads) || leads.length === 0) return NextResponse.json({ error: "No leads provided" }, { status: 400 });

    try {
      await assertLeadCapacity(userId, leads.length);
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
      }
      throw err;
    }

    // Deduct credits for lead imports (only for free/paying users).
    // Paid subscribers import for free.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (user?.plan === "free") {
      const importCost = Math.ceil(leads.length * CREDIT_COSTS.leadImport);
      try {
        await spendCredits(userId, importCost, "lead_import");
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return NextResponse.json({ error: "Not enough credits to import this many leads. Buy more credits or upgrade.", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
        }
        throw err;
      }
    }

    const seenEmails = new Set<string>();
    let imported = 0, errors = 0, skipped = 0, firstError = "";
    const duplicateEmails: string[] = [];
    for (const lead of leads) {
      if (!lead.email || !lead.email.includes("@")) { skipped++; continue; }
      const normalized = lead.email.trim().toLowerCase();
      if (seenEmails.has(normalized)) { duplicateEmails.push(normalized); continue; }
      seenEmails.add(normalized);

      try {
        await prisma.lead.create({
          data: {
            email: normalized,
            firstName: lead.firstName || null,
            lastName: lead.lastName || null,
            company: lead.company || null,
            title: lead.title || null,
            phone: lead.phone || null,
            website: lead.website || null,
            personalization: lead.personalization || null,
            location: lead.location || null,
            notes: lead.notes || null,
            customFields: lead.customFields || null,
            verificationStatus: "unverified",
            campaignId,
            userId,
          },
        });
        imported++;
      } catch (e: any) { errors++; if (!firstError) firstError = e?.message || "Unknown"; }
    }
    const totalParsed = imported + errors + skipped + rowsSkippedNoEmail + duplicateEmails.length;
    return NextResponse.json({ imported, errors, skipped: skipped + rowsSkippedNoEmail, total: totalParsed, firstError, duplicates: duplicateEmails.length, duplicateEmails });
  }

  // CSV upload
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const campaignId = (formData.get("campaignId") as string) || null;
  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { userId: true } });
    if (!campaign || campaign.userId !== userId) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
  }
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const firstLineGuess3 = text.split(/\r?\n/)[0] || "";
  const delimGuess3 = detectDelimiter(firstLineGuess3);
  const lines = splitCsvLines(text, delimGuess3);
  if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row" }, { status: 400 });

  const delim = detectDelimiter(lines[0]);
  const originalHeaders3 = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim());
  const headers = originalHeaders3.map(h => h.toLowerCase());
  const emailIdx = findColumn(headers,
    "email", "e-mail", "email address", "mail",
    "emails", "email addresses", "e mail", "e_mail"
  );
  if (emailIdx === -1) return NextResponse.json({ error: "CSV must have an 'email' column" }, { status: 400 });

  const csvSeenEmails = new Set<string>();
  let imported = 0, errors = 0, skipped = 0, firstError = "";
  const duplicateEmails: string[] = [];
  const csvRows: { email: string; leadRow: ReturnType<typeof mapRowToLead> }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delim);
    const email = emailIdx >= 0 ? cols[emailIdx] : "";
    if (!email || !email.includes("@")) { skipped++; continue; }
    const normalized = email.trim().toLowerCase();
    if (csvSeenEmails.has(normalized)) { duplicateEmails.push(normalized); continue; }
    csvSeenEmails.add(normalized);
    csvRows.push({ email: normalized, leadRow: mapRowToLead(headers, cols, originalHeaders3, emailIdx) });
  }

  try {
    await assertLeadCapacity(userId, csvRows.length);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    throw err;
  }

  for (const { email: normalized, leadRow } of csvRows) {
    try {
      await prisma.lead.create({
        data: {
          email: normalized,
          firstName: leadRow.firstName,
          lastName: leadRow.lastName,
          company: leadRow.company,
          title: leadRow.title,
          phone: leadRow.phone,
          website: leadRow.website,
          personalization: leadRow.personalization,
          location: leadRow.location,
          notes: leadRow.notes,
          customFields: leadRow.customFields,
          verificationStatus: "unverified",
          campaignId,
          userId,
        },
      });
      imported++;
    } catch (e: any) { errors++; if (!firstError) firstError = e?.message || "Unknown"; }
  }

  // Send onboarding email if this is the user's first lead import
  const leadCount = await prisma.lead.count({ where: { userId, deletedAt: null } });
  if (leadCount <= imported) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) sendEmailSafe(user.email, "onboarding-import-leads");
  }

  return NextResponse.json({ imported, errors, skipped, total: lines.length - 1, firstError, duplicates: duplicateEmails.length, duplicateEmails });
}