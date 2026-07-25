import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header style={{ padding: "24px clamp(20px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 20, letterSpacing: "-0.01em", color: "#0F1929", textDecoration: "none" }}>
          Coldpilot
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#5A6B87", textDecoration: "none" }}>Back to home</Link>
      </header>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px clamp(20px,4vw,40px) 80px" }}>
        <h1 style={{ fontSize: "clamp(28px,4vw,36px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: "#8A9BB5", marginBottom: 40 }}>Last updated: July 25, 2026</p>

        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>1. Information We Collect</h2>
          <p style={{ marginBottom: 16 }}>We collect information you provide directly: your name, email address, and payment information when you create an account. We also collect email content you upload for campaigns and recipient email addresses from your imported leads.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>2. How We Use Your Information</h2>
          <p style={{ marginBottom: 16 }}>We use your information to provide, maintain, and improve our services, including sending email campaigns on your behalf, providing analytics, and communicating with you about your account.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>3. Data Sharing</h2>
          <p style={{ marginBottom: 16 }}>We do not sell your personal information. We may share data with third-party service providers who assist in operating our platform, such as email delivery services and payment processors.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>4. Data Security</h2>
          <p style={{ marginBottom: 16 }}>We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>5. Your Rights</h2>
          <p style={{ marginBottom: 16 }}>You can access, update, or delete your account information at any time from your dashboard settings. You may also contact us to request a copy of all data we hold about you.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>6. Contact</h2>
          <p>For questions about this privacy policy, contact us at <a href="mailto:hello@coldpilot.io" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.15)" }}>hello@coldpilot.io</a>.</p>
        </div>
      </main>
    </div>
  );
}
