import Link from "next/link";
import Logo from "@/components/logo";

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          <Logo height={22} />
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none" }}>Back to home</Link>
      </header>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px clamp(20px,4vw,40px) 80px" }}>
        <h1 style={{ fontSize: "clamp(28px,4vw,36px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: "#8A9BB5", marginBottom: 40 }}>Last updated: August 30, 2026</p>

        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>1. Acceptance of Terms</h2>
          <p style={{ marginBottom: 16 }}>By accessing or using Coldpilot, you agree to these Terms of Service. If you do not agree, do not use the service.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>2. Description of Service</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot is a cold email outreach platform that provides email warm-up, campaign management, and deliverability tools. You are responsible for complying with all applicable email laws and regulations.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>3. Account Responsibilities</h2>
          <p style={{ marginBottom: 16 }}>You are responsible for maintaining the security of your account and for all activities that occur under your account. You must provide accurate and complete information when creating your account.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>4. Acceptable Use</h2>
          <p style={{ marginBottom: 16 }}>You agree not to use Coldpilot for sending spam, phishing, or any content that violates applicable laws. We reserve the right to suspend accounts that violate these terms.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>5. Payment and Cancellation</h2>
          <p style={{ marginBottom: 16 }}>Paid plans are billed monthly. You may cancel at any time from your settings. Cancellation takes effect at the end of the current billing period.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>6. Limitation of Liability</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot is provided &ldquo;as is&rdquo; without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>7. Contact</h2>
          <p>For questions about these terms, contact us at <a href="mailto:hello@mail.usecoldpilot.com" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.15)" }}>hello@mail.usecoldpilot.com</a>.</p>
        </div>
      </main>
    </div>
  );
}
