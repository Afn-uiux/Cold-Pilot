import type { Metadata } from "next";
import Link from "next/link";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Use cases",
  description: "Cold email for founders, agencies, sales teams, recruiters, fundraising, and everyone else sending outreach.",
  alternates: { canonical: "/use-cases" },
};

const items = [
  { href: "/use-cases/founders", title: "Founders", desc: "Run intro sequences without burning founder@. Warm your personal inbox and keep it healthy." },
  { href: "/use-cases/agencies", title: "Agencies", desc: "Outbound for many clients on many domains — rotation and warm-up keep every portfolio address clean." },
  { href: "/use-cases/sales", title: "Sales teams", desc: "Distribute sends across every rep, stop on reply, and never trample an active conversation." },
  { href: "/use-cases/recruiters", title: "Recruiters", desc: "Candidate outreach from personal mailboxes, with deliverability that survives inbox rotation." },
  { href: "/use-cases/fundraising", title: "Fundraising", desc: "A focused sequence that lands in the inbox and stops the moment an investor replies." },
  { href: "/auth/signup", title: "And more", desc: "Freelancers, growth, e-commerce, consultants, non-profits — Coldpilot works for any solo cold sender." },
];

export default function UseCasesPage() {
  return (
    <MarketingPage
      label="Use cases"
      title={<>Cold email, built around <em style={{ fontStyle: "italic" }}>who sends it.</em></>}
      desc="The same engine powers outreach for founders, agencies, sales teams, recruiters, and fundraisers — plus anyone else sending cold email alone."
    >
      <section className="mp-body">
        <div className="wrap uc-grid">
          {items.map((p) => (
            <Link key={p.title} href={p.href} className="uc-card">
              <h2>{p.title}</h2>
              <p>{p.desc}</p>
              <span className="uc-go">Learn more<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            </Link>
          ))}
        </div>
      </section>
      <style>{`
        .uc-grid{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border)}
        .uc-card{display:flex;flex-direction:column;gap:10px;padding:28px 26px;background:var(--cream);text-decoration:none;color:var(--ink);transition:background .15s}
        .uc-card:hover{background:#F6F5F2}
        .uc-card h2{font-family:"Instrument Serif",Georgia,serif;font-size:24px;font-weight:400;letter-spacing:-.01em;margin:0}
        .uc-card p{font-size:14px;color:var(--muted);line-height:1.65;margin:0}
        .uc-go{display:inline-flex;align-items:center;gap:6px;margin-top:auto;padding-top:8px;font-size:13px;font-weight:500;color:var(--blue)}
        .uc-go svg{transition:transform .15s}
        .uc-card:hover .uc-go svg{transform:translateX(3px)}
        @media(max-width:720px){.uc-grid{grid-template-columns:1fr}.mp-body{padding:56px 0}}
      `}</style>
    </MarketingPage>
  );
}
