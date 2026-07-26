import Link from "next/link";

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none" }}>
          Coldpilot
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none" }}>Back to home</Link>
      </header>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px clamp(20px,4vw,40px) 80px" }}>
        <h1 style={{ fontSize: "clamp(28px,4vw,36px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 8 }}>About Coldpilot</h1>
        <p style={{ fontSize: 13, color: "#8A9BB5", marginBottom: 40 }}>Built by Too Design</p>

        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>What Coldpilot is</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot is an all-in-one sales outreach platform designed to help businesses find leads and automate cold email campaigns at scale. It combines lead generation, campaign management, and AI-powered tools for businesses running high-volume outbound sales.</p>
          <p style={{ marginBottom: 16 }}>Most outreach platforms charge per lead, per feature, or per seat — and the costs stack up fast before you&apos;ve sent a single email. Coldpilot was built to give growing businesses the same infrastructure that expensive enterprise platforms offer, without the pricing games.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>How it works</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot handles the full outbound workflow in three phases:</p>
          <p style={{ marginBottom: 16 }}><strong>1. Find and verify leads.</strong> Import leads from CSV or add them manually. Coldpilot deduplicates your list automatically and verifies every email address using multiple layers — disposable domain detection, typosquat catching, DNS checks, and SMTP-level verification. Bad emails get flagged before you waste a send on them.</p>
          <p style={{ marginBottom: 16 }}><strong>2. Build and launch campaigns.</strong> Create multi-step sequences with personalized subject lines and body text. Connect your email accounts — Gmail, Outlook, or any SMTP provider — and Coldpilot rotates sends across all of them. Smart scheduling spaces sends with natural delays so your patterns look human, not robotic.</p>
          <p style={{ marginBottom: 16 }}><strong>3. Monitor and optimize.</strong> Coldpilot watches for replies, bounces, and auto-responses in real time. When a lead interacts, their sequence stops immediately. You get analytics on opens, replies, and bounces — and domain reputation tracking tells you which sender addresses are performing and which need attention.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>What makes it different</h2>
          <p style={{ marginBottom: 16 }}><strong>Lead generation built in.</strong> Import leads, verify emails, and manage your pipeline without needing a separate lead database or verification service.</p>
          <p style={{ marginBottom: 16 }}><strong>AI-powered at every step.</strong> Generate email copy with AI, use AI-created warm-up content so no two emails look the same, and get smart recommendations when deliverability issues arise.</p>
          <p style={{ marginBottom: 16 }}><strong>Deliverability-first.</strong> Inbox warm-up, multi-inbox rotation, bounce protection, spam-score checks, and domain reputation monitoring — everything is designed to keep your emails landing in inboxes, not spam folders.</p>
          <p style={{ marginBottom: 16 }}><strong>Transparent.</strong> The codebase is a standard Next.js + Prisma stack. You can inspect every part of the system, modify the email templates, or extend the API.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>The technology</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot is built with Next.js 16, TypeScript, Prisma, and BullMQ. It connects to Gmail and Outlook via OAuth for authentication, and supports any SMTP server for sending. The warm-up system uses a network of accounts that exchange messages and simulate natural email behavior. Reply detection runs over IMAP, checking for replies, bounces, and auto-responses in real time.</p>
          <p style={{ marginBottom: 16 }}>Email verification uses a multi-layer approach: disposable domain detection (129,000+ known domains), typosquat detection for common misspellings, DNS MX validation, and SMTP-level verification through connected accounts.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>Built by</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot is built by <strong>Too Design</strong> — a studio focused on making sales tools that work the way they should, without the bloat or the pricing games.</p>
          <p style={{ marginBottom: 16 }}>Questions? Reach out at <a href="mailto:hello@coldpilot.io" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.15)" }}>hello@coldpilot.io</a>.</p>
        </div>
      </main>
    </div>
  );
}
