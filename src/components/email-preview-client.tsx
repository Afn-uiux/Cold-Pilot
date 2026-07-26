"use client";

import { useState } from "react";
import type { EmailTemplate } from "@/lib/email/templates";

interface Props {
  templates: EmailTemplate[];
  htmlMap: Record<string, string>;
}

export default function EmailPreviewClient({ templates, htmlMap }: Props) {
  const CATEGORIES = Array.from(new Set(templates.map(t => t.category)));
  const [selected, setSelected] = useState<string>(templates[0]?.id || "welcome");
  const [filter, setFilter] = useState<string>("all");
  const [showHtml, setShowHtml] = useState(false);

  const template = templates.find(t => t.id === selected);
  const html = htmlMap[selected] || "";

  const filtered = filter === "all"
    ? templates
    : templates.filter(t => t.category === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", borderBottom: "1px solid #E8E5E0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", letterSpacing: "-0.02em" }}>Email Templates</h1>
          <p style={{ fontSize: 13, color: "#8A9BB5", marginTop: 4 }}>{templates.length} templates across {CATEGORIES.length} categories</p>
        </div>
        <a href="/dashboard" style={{ fontSize: 13, color: "#5A6B87", textDecoration: "none" }}>Back to Dashboard</a>
      </header>

      <div style={{ display: "flex", height: "calc(100vh - 85px)" }}>
        {/* Sidebar */}
        <div style={{ width: 280, borderRight: "1px solid #E8E5E0", background: "#fff", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "16px 16px 8px" }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setFilter("all")}
                style={{ padding: "5px 10px", fontSize: 11, fontWeight: 500, borderRadius: 6, border: "1px solid", borderColor: filter === "all" ? "#0F1929" : "#E8E5E0", background: filter === "all" ? "#0F1929" : "transparent", color: filter === "all" ? "#fff" : "#5A6B87", cursor: "pointer", fontFamily: "inherit" }}>
                All
              </button>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setFilter(cat)}
                  style={{ padding: "5px 10px", fontSize: 11, fontWeight: 500, borderRadius: 6, border: "1px solid", borderColor: filter === cat ? "#0F1929" : "#E8E5E0", background: filter === cat ? "#0F1929" : "transparent", color: filter === cat ? "#fff" : "#5A6B87", cursor: "pointer", fontFamily: "inherit" }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "8px 8px 16px" }}>
            {filtered.map((t) => (
              <button key={t.id} onClick={() => setSelected(t.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px", fontSize: 13,
                  background: selected === t.id ? "#F0EEEB" : "transparent",
                  border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                  color: selected === t.id ? "#0F1929" : "#5A6B87",
                }}>
                <div style={{ fontWeight: selected === t.id ? 500 : 400 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: "#8A9BB5", marginTop: 2 }}>{t.category}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, color: "#0F1929" }}>{template?.subject}</h2>
              <p style={{ fontSize: 12, color: "#8A9BB5", marginTop: 4 }}>{template?.category}</p>
            </div>
            <button onClick={() => setShowHtml(v => !v)}
              style={{ padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: "1px solid #E8E5E0", background: showHtml ? "#0F1929" : "#fff", color: showHtml ? "#fff" : "#5A6B87", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
              {showHtml ? "Preview" : "HTML"}
            </button>
          </div>

          {showHtml ? (
            <pre style={{ background: "#0F1929", color: "#E8E5E0", padding: 24, borderRadius: 12, fontSize: 12, lineHeight: 1.6, overflow: "auto", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {html}
            </pre>
          ) : (
            <div style={{ background: "#E8E5E0", borderRadius: 12, padding: 24 }}>
              <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
                <div style={{ background: "#374151", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E" }} />
                  </div>
                  <div style={{ flex: 1, background: "#1F2937", borderRadius: 4, padding: "4px 12px", fontSize: 11, color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace" }}>
                    {`mailto:notifications@coldpilot.io — ${template?.subject}`}
                  </div>
                </div>
                <iframe srcDoc={html} style={{ width: "100%", height: 700, border: "none" }} title={template?.subject} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
