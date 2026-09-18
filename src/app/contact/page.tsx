import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about ColdPilot plans, credits, billing or deliverability? Email hello@mail.usecoldpilot.com and we'll reply within one business day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <SiteHeader />
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px clamp(20px,4vw,40px) 80px" }}>
        <h1 style={{ fontSize: "clamp(28px,4vw,36px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 8 }}>Contact</h1>
        <p style={{ fontSize: 13, color: "#8A9BB5", marginBottom: 40 }}>Get in touch with the ColdPilot team</p>

        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
          <p style={{ marginBottom: 24 }}>Email us at <a href="mailto:hello@mail.usecoldpilot.com" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.15)" }}>hello@mail.usecoldpilot.com</a> and we&apos;ll get back to you within one business day.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>What we can help with</h2>
          <p style={{ marginBottom: 16 }}><strong>Account &amp; billing.</strong> Questions about plans, credit packs, or invoices.</p>
          <p style={{ marginBottom: 16 }}><strong>Deliverability.</strong> Warm-up, inbox rotation, or getting your emails out of spam.</p>
          <p style={{ marginBottom: 16 }}><strong>Bugs &amp; feedback.</strong> Something broken, or an idea for the product — we read everything.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>Send us a message</h2>
          <form
            action="mailto:hello@mail.usecoldpilot.com"
            method="post"
            encType="text/plain"
            style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}
          >
            <input
              type="email"
              name="Email"
              placeholder="Your email"
              required
              style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #D7DFEA", fontSize: 14, fontFamily: "inherit", background: "#fff" }}
            />
            <input
              type="text"
              name="Subject"
              placeholder="Subject"
              required
              style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #D7DFEA", fontSize: 14, fontFamily: "inherit", background: "#fff" }}
            />
            <textarea
              name="Message"
              placeholder="How can we help?"
              required
              rows={6}
              style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #D7DFEA", fontSize: 14, fontFamily: "inherit", background: "#fff", resize: "vertical" }}
            />
            <button
              type="submit"
              style={{ alignSelf: "flex-start", padding: "11px 22px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}
            >
              Send message
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
