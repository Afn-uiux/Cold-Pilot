import { readFileSync } from "fs";
import { join } from "path";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";
import EmailPreviewClient from "@/components/email-preview-client";

export const dynamic = "force-dynamic";

export default function EmailPreviewsPage() {
  const htmlMap: Record<string, string> = {};

  for (const template of EMAIL_TEMPLATES) {
    try {
      const filePath = join(process.cwd(), "src", "lib", "email", "templates-html", template.filename);
      htmlMap[template.id] = readFileSync(filePath, "utf-8");
    } catch {
      htmlMap[template.id] = `<html><body><p>Template file not found: ${template.filename}</p></body></html>`;
    }
  }

  return <EmailPreviewClient templates={EMAIL_TEMPLATES} htmlMap={htmlMap} />;
}
