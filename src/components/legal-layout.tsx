"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/logo";

export interface LegalSection {
  id: string;
  label: string;
}

const DOCS: { id: LegalDocId; label: string; href: string }[] = [
  { id: "privacy", label: "Privacy Policy", href: "/legal/privacy" },
  { id: "terms", label: "Terms of Service", href: "/legal/terms" },
  { id: "acceptable-use", label: "Acceptable Use Policy", href: "/legal/acceptable-use" },
];

export type LegalDocId = "privacy" | "terms" | "acceptable-use";

export default function LegalLayout({
  doc,
  sections,
  children,
}: {
  doc: LegalDocId;
  sections: LegalSection[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          <Logo height={22} />
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none" }}>Back to home</Link>
      </header>

      <main style={{ maxWidth: 1152, margin: "0 auto", padding: "32px clamp(20px,4vw,40px) 96px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,220px) 1fr", gap: "clamp(32px,6vw,88px)", alignItems: "start" }}>
          <aside className="legal-sidebar" style={{ position: "sticky", top: 40, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0F1929", margin: "0 0 16px 0", letterSpacing: "-0.01em" }}>Legal</h2>
            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {DOCS.map((d) => {
                const isActive = d.id === doc;
                return (
                  <Link
                    key={d.id}
                    href={d.href}
                    className="legal-doc-btn"
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 14,
                      textDecoration: "none",
                      border: "1px solid",
                      borderColor: isActive ? "#2563EB" : "transparent",
                      background: isActive ? "#2563EB" : "transparent",
                      color: isActive ? "#FFFFFF" : "#5A6B87",
                      fontWeight: isActive ? 600 : 400,
                      fontFamily: "'Geist', system-ui, sans-serif",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                  >
                    {d.label}
                  </Link>
                );
              })}
            </nav>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 24, paddingTop: 20, borderTop: "1px solid #E8E5E0" }}>
              {sections.map((s) => {
                const isActive = s.id === active;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="legal-section-btn"
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 13,
                      textDecoration: "none",
                      background: isActive ? "#0F1929" : "transparent",
                      color: isActive ? "#FFFFFF" : "#5A6B87",
                      fontWeight: isActive ? 600 : 400,
                      lineHeight: 1.4,
                      fontFamily: "'Geist', system-ui, sans-serif",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                  >
                    {s.label}
                  </a>
                );
              })}
            </div>
          </aside>

          <div className="legal-main" style={{ minWidth: 0 }}>
            {children}
          </div>
        </div>

        <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid #E8E5E0", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 13, color: "#8A9BB5" }}>
          <span>&copy; 2026 ColdPilot, Inc.</span>
          <span>Made for the inbox, not the spam folder.</span>
        </div>
      </main>

      <style>{`
        .legal-sidebar::-webkit-scrollbar { width: 0; }
        .legal-main h1 { font-size: clamp(28px,4vw,36px); font-weight: 700; letter-spacing: -0.02em; color: #0F1929; margin: 0 0 8px 0; }
        .legal-main .effective-date { font-size: 13px; color: #8A9BB5; margin: 0 0 28px 0; }
        .legal-main p { font-size: 15px; color: #374151; line-height: 1.75; margin: 0 0 16px 0; }
        .legal-main h2 { font-size: 18px; font-weight: 600; color: #0F1929; letter-spacing: -0.01em; margin: 0 0 18px 0; padding-bottom: 12px; border-bottom: 2px solid #E8E5E0; scroll-margin-top: 24px; }
        .legal-main h3 { font-size: 15px; font-weight: 600; color: #0F1929; margin: 24px 0 10px 0; }
        .legal-main a { color: #2563EB; text-decoration: none; }
        .legal-main ul { padding-left: 20px; display: flex; flex-direction: column; gap: 6px; margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.7; }
        .legal-main .section { margin-bottom: 40px; scroll-margin-top: 8px; }
        .legal-doc-btn:hover { background: rgba(15,25,41,0.04); }
        .legal-section-btn:hover { background: rgba(15,25,41,0.04); }
        @media (max-width: 760px) {
          .legal-sidebar { position: static !important; max-height: none !important; }
        }
      `}</style>
    </div>
  );
}