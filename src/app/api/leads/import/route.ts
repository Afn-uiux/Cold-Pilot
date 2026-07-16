export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const contentType = req.headers.get("content-type") || "";

  // JSON import (from link / paste / bulk)
  if (contentType.includes("application/json")) {
    const body = await req.json();
    let leads = body.leads;
    let campaignId: string | null = body.campaignId || null;

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
                signal: AbortSignal.timeout(15000),
              });
              if (!r.ok) continue;
              const text = await r.text();
              // Skip HTML login/consent pages — real CSV starts with a header row
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
          const lines = csvText.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) return NextResponse.json({ error: "Sheet has no data rows" }, { status: 400 });
          const delim = detectDelimiter(lines[0]);
          const headers = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim().toLowerCase());
          const emailIdx = findColumn(headers,
            "email", "e-mail", "email address", "mail",
            "emails", "email addresses", "e mail", "e_mail"
          );
          if (emailIdx === -1) return NextResponse.json({ error: "No 'email' column found in the sheet" }, { status: 400 });
          leads = lines.slice(1).map(line => {
            const cols = parseCsvLine(line, delim);
            return {
              email: cols[emailIdx] || "",
              firstName: findHeader(headers, cols,
                "first name", "firstname", "first_name", "fname", "first",
                "given name", "full name", "fullname", "forename", "given-name"
              ) || findExact(headers, cols, "name"),
              lastName: findHeader(headers, cols,
                "last name", "lastname", "last_name", "lname", "surname",
                "last", "family name", "family_name", "familyname", "second name",
                "last-name"
              ),
              company: findHeader(headers, cols,
                "company", "organization", "org", "business", "firm",
                "company name", "company_name", "company-name", "business name",
                "business_name", "employer", "co", "organisation", "account"
              ),
              title: findHeader(headers, cols,
                "title", "job title", "position", "role", "designation",
                "job position", "job_position", "job-title", "job role",
                "job_role", "position title", "position_title"
              ),
              phone: findHeader(headers, cols,
                "phone", "telephone", "tel", "mobile", "cell",
                "phone number", "phone_number", "contact number", "contact_number",
                "phone #", "phone#", "phone no", "phone_no", "phone no.",
                "mobile phone", "mobile_number", "work phone", "work_phone",
                "cell phone", "cellphone"
              ),
              website: findHeader(headers, cols,
                "website", "web", "url", "site", "company website",
                "company_website", "web site", "website url", "website_url",
                "linkedin url", "linkedin_url", "linkedin", "company site",
                "company_site", "webpage", "web page", "web page url"
              ),
              personalization: findHeader(headers, cols,
                "personalization", "custom", "personalized", "custom field",
                "custom_field", "custom1", "custom2", "custom field 1",
                "personalize", "personalisation", "note personalization",
                "personalized note", "custom note", "personal note",
                "personal_note", "custom text", "notes_personalization"
              ),
              location: findLocation(headers, cols),
              notes: findHeader(headers, cols,
                "notes", "note", "comments", "description",
                "additional notes", "additional_info", "extra notes",
                "remarks", "extra info", "extra_information"
              ),
            };
          }).filter(l => l.email && l.email.includes("@"));
        } else {
          // Non-Google URL: fetch directly
          const res = await fetch(url, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) return NextResponse.json({ error: `Server returned ${res.status}. Make sure the link is a public CSV file.` }, { status: 400 });
          const text = await res.text();
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) return NextResponse.json({ error: "No data rows found in the file" }, { status: 400 });
          const delim = detectDelimiter(lines[0]);
          const headers = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim().toLowerCase());
          const emailIdx = findColumn(headers,
            "email", "e-mail", "email address", "mail",
            "emails", "email addresses", "e mail", "e_mail"
          );
          if (emailIdx === -1) return NextResponse.json({ error: "No 'email' column found" }, { status: 400 });
          leads = lines.slice(1).map(line => {
            const cols = parseCsvLine(line, delim);
            return {
              email: cols[emailIdx] || "",
              firstName: findHeader(headers, cols,
                "first name", "firstname", "first_name", "fname", "first",
                "given name", "full name", "fullname", "forename", "given-name"
              ) || findExact(headers, cols, "name"),
              lastName: findHeader(headers, cols,
                "last name", "lastname", "last_name", "lname", "surname",
                "last", "family name", "family_name", "familyname", "second name",
                "last-name"
              ),
              company: findHeader(headers, cols,
                "company", "organization", "org", "business", "firm",
                "company name", "company_name", "company-name", "business name",
                "business_name", "employer", "co", "organisation", "account"
              ),
              title: findHeader(headers, cols,
                "title", "job title", "position", "role", "designation",
                "job position", "job_position", "job-title", "job role",
                "job_role", "position title", "position_title"
              ),
              phone: findHeader(headers, cols,
                "phone", "telephone", "tel", "mobile", "cell",
                "phone number", "phone_number", "contact number", "contact_number",
                "phone #", "phone#", "phone no", "phone_no", "phone no.",
                "mobile phone", "mobile_number", "work phone", "work_phone",
                "cell phone", "cellphone"
              ),
              website: findHeader(headers, cols,
                "website", "web", "url", "site", "company website",
                "company_website", "web site", "website url", "website_url",
                "linkedin url", "linkedin_url", "linkedin", "company site",
                "company_site", "webpage", "web page", "web page url"
              ),
              personalization: findHeader(headers, cols,
                "personalization", "custom", "personalized", "custom field",
                "custom_field", "custom1", "custom2", "custom field 1",
                "personalize", "personalisation", "note personalization",
                "personalized note", "custom note", "personal note",
                "personal_note", "custom text", "notes_personalization"
              ),
              location: findLocation(headers, cols),
              notes: findHeader(headers, cols,
                "notes", "note", "comments", "description",
                "additional notes", "additional_info", "extra notes",
                "remarks", "extra info", "extra_information"
              ),
            };
          }).filter(l => l.email && l.email.includes("@"));
        }
        const headers = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim().toLowerCase());
        const emailIdx = findColumn(headers,
          "email", "e-mail", "email address", "mail",
          "emails", "email addresses", "e mail", "e_mail"
        );
        if (emailIdx === -1) return NextResponse.json({ error: "No 'email' column found" }, { status: 400 });
          leads = lines.slice(1).map(line => {
            const cols = parseCsvLine(line, delim);
          return {
            email: cols[emailIdx] || "",
            firstName: findHeader(headers, cols,
              "first name", "firstname", "first_name", "fname", "first",
              "given name", "full name", "fullname", "forename", "given-name"
            ) || findExact(headers, cols, "name"),
            lastName: findHeader(headers, cols,
              "last name", "lastname", "last_name", "lname", "surname",
              "last", "family name", "family_name", "familyname", "second name",
              "last-name"
            ),
            company: findHeader(headers, cols,
              "company", "organization", "org", "business", "firm",
              "company name", "company_name", "company-name", "business name",
              "business_name", "employer", "co", "organisation", "account"
            ),
            title: findHeader(headers, cols,
              "title", "job title", "position", "role", "designation",
              "job position", "job_position", "job-title", "job role",
              "job_role", "position title", "position_title"
            ),
            phone: findHeader(headers, cols,
              "phone", "telephone", "tel", "mobile", "cell",
              "phone number", "phone_number", "contact number", "contact_number",
              "phone #", "phone#", "phone no", "phone_no", "phone no.",
              "mobile phone", "mobile_number", "work phone", "work_phone",
              "cell phone", "cellphone"
            ),
            website: findHeader(headers, cols,
              "website", "web", "url", "site", "company website",
              "company_website", "web site", "website url", "website_url",
              "linkedin url", "linkedin_url", "linkedin", "company site",
              "company_site", "webpage", "web page", "web page url"
            ),
            personalization: findHeader(headers, cols,
              "personalization", "custom", "personalized", "custom field",
              "custom_field", "custom1", "custom2", "custom field 1",
              "personalize", "personalisation", "note personalization",
              "personalized note", "custom note", "personal note",
              "personal_note", "custom text", "notes_personalization"
            ),
            location: findLocation(headers, cols),
            notes: findHeader(headers, cols,
              "notes", "note", "comments", "description",
              "additional notes", "additional_info", "extra notes",
              "remarks", "extra info", "extra_information"
            ),
          };
        }).filter(l => l.email && l.email.includes("@"));
      } catch (err: any) {
        return NextResponse.json({ error: `Failed to fetch: ${err.message}` }, { status: 400 });
      }
    }

    if (!Array.isArray(leads) || leads.length === 0) return NextResponse.json({ error: "No leads provided" }, { status: 400 });

    let imported = 0, errors = 0, firstError = "";
    for (const lead of leads) {
      if (!lead.email || !lead.email.includes("@")) { errors++; continue; }
      try {
        await prisma.lead.create({
          data: {
            email: lead.email.trim().toLowerCase(),
            firstName: lead.firstName || null,
            lastName: lead.lastName || null,
            company: lead.company || null,
            title: lead.title || null,
            phone: lead.phone || null,
            website: lead.website || null,
            personalization: lead.personalization || null,
            location: lead.location || null,
            notes: lead.notes || null,
            campaignId,
            userId,
          },
        });
        imported++;
      } catch (e: any) { errors++; if (!firstError) firstError = e?.message || "Unknown"; }
    }
    return NextResponse.json({ imported, errors, total: leads.length, firstError });
  }

  // CSV upload
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const campaignId = (formData.get("campaignId") as string) || null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row" }, { status: 400 });

  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim).map(h => h.replace(/^﻿/, "").trim().toLowerCase());
  const emailIdx = findColumn(headers,
    "email", "e-mail", "email address", "mail",
    "emails", "email addresses", "e mail", "e_mail"
  );
  if (emailIdx === -1) return NextResponse.json({ error: "CSV must have an 'email' column" }, { status: 400 });

  let imported = 0, errors = 0, firstError = "";
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delim);
    const email = cols[emailIdx];
    if (!email || !email.includes("@")) { errors++; continue; }
    try {
      const leadRow = {
        email: email.trim().toLowerCase(),
        firstName: findHeader(headers, cols,
          "first name", "firstname", "first_name", "fname", "first",
          "given name", "full name", "fullname", "forename", "given-name"
        ) || findExact(headers, cols, "name"),
        lastName: findHeader(headers, cols,
          "last name", "lastname", "last_name", "lname", "surname",
          "last", "family name", "family_name", "familyname", "second name",
          "last-name"
        ),
        company: findHeader(headers, cols,
          "company", "organization", "org", "business", "firm",
          "company name", "company_name", "company-name", "business name",
          "business_name", "employer", "co", "organisation", "account",
          "company name"
        ),
        title: findHeader(headers, cols,
          "title", "job title", "position", "role", "designation",
          "job position", "job_position", "job-title", "job role",
          "job_role", "position title", "position_title"
        ),
        phone: findHeader(headers, cols,
          "phone", "telephone", "tel", "mobile", "cell",
          "phone number", "phone_number", "contact number", "contact_number",
          "phone #", "phone#", "phone no", "phone_no", "phone no.",
          "mobile phone", "mobile_number", "work phone", "work_phone",
          "cell phone", "cellphone"
        ),
        website: findHeader(headers, cols,
          "website", "web", "url", "site", "company website",
          "company_website", "web site", "website url", "website_url",
          "linkedin url", "linkedin_url", "linkedin", "company site",
          "company_site", "webpage", "web page", "web page url"
        ),
        personalization: findHeader(headers, cols,
          "personalization", "custom", "personalized", "custom field",
          "custom_field", "custom1", "custom2", "custom field 1",
          "personalize", "personalisation", "note personalization",
          "personalized note", "custom note", "personal note",
          "personal_note", "custom text", "notes_personalization"
        ),
        location: findLocation(headers, cols),
        notes: findHeader(headers, cols,
          "notes", "note", "comments", "description",
          "additional notes", "additional_info", "extra notes",
          "remarks", "extra info", "extra_information"
        ),
      };
      await prisma.lead.create({
        data: {
          email: leadRow.email,
          firstName: leadRow.firstName,
          lastName: leadRow.lastName,
          company: leadRow.company,
          title: leadRow.title,
          phone: leadRow.phone,
          website: leadRow.website,
          personalization: leadRow.personalization,
          location: leadRow.location,
          notes: leadRow.notes,
          campaignId,
          userId,
        },
      });
      imported++;
    } catch (e: any) { errors++; if (!firstError) firstError = e?.message || "Unknown"; }
  }

  return NextResponse.json({ imported, errors, total: lines.length - 1, firstError });
}
