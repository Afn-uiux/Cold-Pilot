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
        <p style={{ fontSize: 13, color: "#8A9BB5", marginBottom: 40 }}>Last updated: August 30, 2026</p>

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

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>6. Use of Google Gmail Data</h2>
          <p style={{ marginBottom: 16 }}>Coldpilot's use and transfer of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.15)" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
          <p style={{ marginBottom: 16 }}>When you connect a Gmail inbox through Google OAuth, we access your Gmail account solely to perform the functions you request: sending outreach emails on your behalf and reading replies/threads to detect responses and keep your campaign conversations accurate. This access is limited to the minimum scopes required (send, read, and modify your own Gmail messages and threads).</p>
          <p style={{ marginBottom: 16 }}>Specifically, we may read and write to your Gmail messages and threads for the purpose of sending, tracking, and mirroring your outreach conversations. We do not read the full content of unrelated messages for advertising or other unrelated purposes. We do not sell Gmail data or transfer it to third parties except as necessary to operate the service (e.g., storing it on our encrypted servers) or as required by law.</p>
          <p style={{ marginBottom: 16 }}>Gmail data is used only for providing and improving the Coldpilot service. You can disconnect your Gmail account at any time from your dashboard. Data may be retained while your account is active or as required for legal/security purposes, and is deleted when you close your account or remove the connected mailbox.</p>

          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 32, marginBottom: 12, color: "#0F1929" }}>7. Contact</h2>
          <p>For questions about this privacy policy, contact us at <a href="mailto:hello@usecoldpilot.com" style={{ color: "#0F1929", borderBottom: "1px solid rgba(15,25,41,0.15)" }}>hello@usecoldpilot.com</a>.</p>
        </div>
      </main>
    </div>
  );
}
