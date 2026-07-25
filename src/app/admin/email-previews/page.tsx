"use client";

import { useState } from "react";
import { emailTemplates, type EmailTemplateId } from "@/lib/email/templates";

const CATEGORIES = Array.from(new Set(Object.values(emailTemplates).map(t => t.category)));

const SAMPLE_DATA: Record<string, any> = {
  "welcome": { name: "Alex" },
  "email-verification": { name: "Alex", token: "demo-token-123" },
  "password-reset": { name: "Alex", token: "demo-token-456" },
  "password-changed": { name: "Alex" },
  "trial-started": { name: "Alex", days: 14 },
  "trial-expiring-3": { name: "Alex", date: "Aug 8, 2026" },
  "trial-expiring-1": { name: "Alex" },
  "trial-ended": { name: "Alex" },
  "payment-succeeded": { name: "Alex", amount: "$29", date: "Jul 25", nextBilling: "Aug 25" },
  "payment-failed": { name: "Alex" },
  "subscription-cancelled": { name: "Alex", date: "Aug 15, 2026" },
  "plan-changed": { name: "Alex", oldPlan: "Free", newPlan: "Pro" },
  "card-expiring": { name: "Alex", expiry: "next month" },
  "campaign-launched": { name: "Alex", campaignName: "Q3 Outreach", leadCount: "342 leads" },
  "campaign-paused": { name: "Alex", campaignName: "Q3 Outreach", reason: "Bounce rate exceeded 5% threshold" },
  "campaign-completed": { name: "Alex", campaignName: "Q3 Outreach", sent: "342", opened: "128", replied: "23" },
  "account-disconnected": { name: "Alex", email: "alex@gmail.com" },
  "bounce-rate-alert": { name: "Alex", campaignName: "Q3 Outreach", bounceRate: "12%" },
  "weekly-digest": { name: "Alex", sent: "1,247", opened: "412", replied: "67", bounced: "18", period: "this week" },
  "monthly-summary": { name: "Alex", sent: "4,891", opened: "1,823", replied: "289", month: "July 2026" },
  "warmup-health-dropped": { name: "Alex", email: "alex@gmail.com", health: "42" },
  "approaching-limit": { name: "Alex", used: "450", limit: "500", percent: "90%", resetDate: "Aug 1" },
  "domain-reputation-warning": { name: "Alex", domain: "coldpilot.io", score: "Low" },
  "onboarding-connect-account": { name: "Alex" },
  "onboarding-create-campaign": { name: "Alex" },
  "onboarding-import-leads": { name: "Alex" },
  "we-miss-you": { name: "Alex" },
};

export default function EmailPreviewsPage() {
  const [selected, setSelected] = useState<EmailTemplateId>("welcome");
  const [filter, setFilter] = useState<string>("all");
  const [showHtml, setShowHtml] = useState(false);

  const template = emailTemplates[selected];
  const sampleData = SAMPLE_DATA[selected] || {};
  const html = template.html(sampleData);

  const filtered = filter === "all"
    ? Object.entries(emailTemplates)
    : Object.entries(emailTemplates).filter(([, t]) => t.category === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", borderBottom: "1px solid #E8E5E0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0F1929", letterSpacing: "-0.02em" }}>Email Templates</h1>
          <p style={{ fontSize: 13, color: "#8A9BB5", marginTop: 4 }}>{Object.keys(emailTemplates).length} templates across {CATEGORIES.length} categories</p>
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
            {filtered.map(([id, t]) => (
              <button key={id} onClick={() => setSelected(id as EmailTemplateId)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px", fontSize: 13,
                  background: selected === id ? "#F0EEEB" : "transparent",
                  border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                  color: selected === id ? "#0F1929" : "#5A6B87",
                }}>
                <div style={{ fontWeight: selected === id ? 500 : 400 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: "#8A9BB5", marginTop: 2 }}>{t.category}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, color: "#0F1929" }}>{template.subject}</h2>
              <p style={{ fontSize: 12, color: "#8A9BB5", marginTop: 4 }}>{template.category}</p>
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
                    {`mailto:notifications@coldpilot.io — ${template.subject}`}
                  </div>
                </div>
                <iframe srcDoc={html} style={{ width: "100%", height: 700, border: "none" }} title={template.subject} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
