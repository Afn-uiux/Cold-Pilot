"use client";

import { Download01Icon } from "@/components/icons/download-01";

function toCsv(rows: Record<string, string>[]): string {
  const esc = (v: string) => {
    let s = v ?? "";
    // Formula-injection neutralization (audit L-8): Excel/GSheets evaluates
    // cells that start with =, +, -, @, or tab/CR as formulas. Prefix those
    // with a single quote so they render as literal text.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}

export function downloadCsv(filename: string, rows: Record<string, string>[]) {
  if (rows.length === 0) return;
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportCsvButton({
  filename,
  rows,
}: {
  filename: string;
  rows: Record<string, string>[];
}) {
  if (rows.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, rows)}
      className="btn btn-ghost btn-xs flex items-center gap-1.5"
    >
      <Download01Icon size={14} />
      CSV
    </button>
  );
}

export function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <h2 className="font-medium text-[clamp(20px,2.5vw,24px)] tracking-tight">{title}</h2>
      {children}
    </div>
  );
}
