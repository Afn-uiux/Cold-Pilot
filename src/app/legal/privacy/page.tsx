import type { Metadata } from "next";
import LegalLayout, { type LegalSection } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Coldpilot's privacy policy — how we collect, use, and protect your personal data when you use our cold email outreach platform.",
  alternates: { canonical: "/legal/privacy" },
};

const SECTIONS: LegalSection[] = [
  { id: "who-we-are", label: "1. Who We Are" },
  { id: "data-we-collect", label: "2. Personal Data We Collect" },
  { id: "how-we-use", label: "3. How We Use Personal Data" },
  { id: "legal-bases", label: "4. Legal Bases for Processing" },
  { id: "how-we-share", label: "5. How We Share Personal Data" },
  { id: "google-data", label: "6. Use of Google Gmail Data" },
  { id: "retention", label: "7. Data Retention" },
  { id: "cookies", label: "8. Cookies and Tracking" },
  { id: "security", label: "9. Data Security" },
  { id: "transfers", label: "10. International Data Transfers" },
  { id: "your-rights", label: "11. Your Rights" },
  { id: "children", label: "12. Children's Privacy" },
  { id: "third-party", label: "13. Third-Party Sites and Services" },
  { id: "changes", label: "14. Changes to This Policy" },
  { id: "contact", label: "15. Contact Us" },
];

export default function PrivacyPage() {
  return (
    <LegalLayout doc="privacy" sections={SECTIONS}>
      <h1>Privacy Policy</h1>
      <p className="effective-date">Effective Date: September 5, 2026</p>

      <p>
        Coldpilot, Inc. (&ldquo;Coldpilot&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) provides cold email
        outreach software &mdash; campaign management, inbox warm-up, rotation, reply detection, verification, and analytics
        (the &ldquo;Services&rdquo;). We are committed to protecting your personal data and being transparent about how we handle it.
      </p>
      <p>
        This Privacy Policy describes how we collect, use, store, share, and protect personal data from our customers
        (&ldquo;Users&rdquo; or &ldquo;you&rdquo;), the recipients of emails sent through our platform, website visitors, and any other
        individuals who interact with our Services. It applies to our website, dashboard, APIs, and all related tools and applications.
      </p>
      <p>
        Your use of the Services is at all times subject to our <a href="/legal/terms">Terms of Service</a> and our{" "}
        <a href="/legal/acceptable-use">Acceptable Use Policy</a>. By accessing or using our Services, you acknowledge and accept the
        practices described below.
      </p>

      <div className="section" id="who-we-are">
        <h2>1. Who We Are</h2>
        <p>Coldpilot, Inc. is a cold email outreach platform. For data protection purposes:</p>
        <ul>
          <li>
            When you send outreach campaigns through our platform, you are the <strong>Data Controller</strong> and we act as a{" "}
            <strong>Data Processor</strong> on your behalf for the recipient data you upload or process.
          </li>
          <li>
            When we collect and process data for our own business operations, analytics, compliance, and marketing, we act as a{" "}
            <strong>Data Controller</strong>.
          </li>
          <li>
            If you are a recipient of an email sent through Coldpilot, your primary relationship is with the sender who contacted you.
            Please review that sender&apos;s privacy policy for information about their data practices. We process recipient data only as
            necessary to provide email delivery, reply detection, and deliverability services to our Users.
          </li>
        </ul>
      </div>

      <div className="section" id="data-we-collect">
        <h2>2. Personal Data We Collect</h2>
        <p>The personal data we collect depends on how you interact with us and the capacity in which you engage with our Services.</p>

        <h3>2.1 Account and Billing Data (Collected Directly)</h3>
        <ul>
          <li><strong>Identity:</strong> name, email address, and password (stored as a secure hash).</li>
          <li><strong>Contact:</strong> email address used for login, notifications, and support.</li>
          <li><strong>Billing:</strong> payment card details handled by our PCI-DSS compliant payment processor. We store only a tokenized
          reference, never full card numbers.</li>
          <li><strong>Connected inboxes:</strong> credentials or OAuth access tokens for the email accounts you connect (Gmail, Outlook,
          or SMTP). Passwords for SMTP accounts are never stored in plaintext.</li>
          <li><strong>Preferences:</strong> sending schedules, warm-up settings, rotation settings, and feature configurations.</li>
          <li><strong>Communications:</strong> support requests and correspondence.</li>
        </ul>

        <h3>2.2 Campaign and Recipient Data (You Provide)</h3>
        <ul>
          <li><strong>Recipient data:</strong> email addresses and any other fields you import (e.g., first names, company names) for
          your outreach lists.</li>
          <li><strong>Campaign content:</strong> email sequences, subject lines, templates, and AI-generation prompts you write.</li>
          <li><strong>Reply data:</strong> replies your connected inboxes receive, used for reply detection and thread tracking.</li>
        </ul>

        <h3>2.3 Data Collected Automatically</h3>
        <ul>
          <li><strong>Log data:</strong> IP address, browser type, operating system, pages viewed, API requests, and error logs.</li>
          <li><strong>Analytics:</strong> session duration, feature interactions, dashboard engagement, and performance metrics.</li>
          <li><strong>Cookies:</strong> see Section 8 below.</li>
        </ul>

        <h3>2.4 Data from Third Parties</h3>
        <ul>
          <li><strong>Email verification providers:</strong> validity status and reason for email addresses you ask us to verify.</li>
          <li><strong>OAuth providers:</strong> account identifiers and granted scopes when you connect Gmail, Outlook, or Google
          Workspace accounts.</li>
        </ul>
      </div>

      <div className="section" id="how-we-use">
        <h2>3. How We Use Personal Data</h2>
        <p>We use personal data for the following purposes:</p>
        <ul>
          <li><strong>Providing and operating the Services:</strong> sending your campaigns, warm-up, rotation, reply detection,
          verification, and analytics.</li>
          <li><strong>Onboarding and account management:</strong> creating accounts, authenticating users, and managing connected
          inboxes.</li>
          <li><strong>Billing:</strong> invoicing, collecting payments, and managing subscriptions.</li>
          <li><strong>Security, fraud prevention, and compliance:</strong> detecting unauthorized access, enforcing our Acceptable Use
          Policy, and meeting legal obligations.</li>
          <li><strong>Improving the Services:</strong> analyzing usage patterns, developing features, and conducting research.</li>
          <li><strong>Communications:</strong> transactional emails (confirmations, notifications, alerts), product updates, and
          responding to support requests.</li>
          <li><strong>Legal and business purposes:</strong> resolving disputes, enforcing agreements, and facilitating business
          transactions.</li>
        </ul>
      </div>

      <div className="section" id="legal-bases">
        <h2>4. Legal Bases for Processing</h2>
        <p>We process personal data on the following legal bases, depending on the purpose:</p>
        <ul>
          <li><strong>Contract:</strong> processing necessary to provide the Services you requested, including account management,
          sending campaigns, and billing.</li>
          <li><strong>Legitimate interests:</strong> security, fraud prevention, product improvement, and direct marketing, balanced
          against your rights and interests.</li>
          <li><strong>Legal obligation:</strong> compliance with applicable laws, such as anti-spam and record-keeping requirements.</li>
          <li><strong>Consent:</strong> where required (for example, optional marketing communications), which you may withdraw at any
          time.</li>
        </ul>
      </div>

      <div className="section" id="how-we-share">
        <h2>5. How We Share Personal Data</h2>
        <p>We do not sell personal data. We do not share data with third parties for their own marketing purposes. We share data only as
        described below.</p>
        <ul>
          <li><strong>Email delivery and infrastructure providers:</strong> we share necessary recipient and message data with service
          providers that deliver your emails on our behalf. These parties process data for us under written agreements.</li>
          <li><strong>Payment processors:</strong> we share necessary billing data to process payments and subscriptions.</li>
          <li><strong>Verification and analytics services:</strong> we share data with providers that verify email addresses or help us
          understand platform usage.</li>
          <li><strong>Legal and regulatory authorities:</strong> where required by law, court order, or valid legal process.</li>
          <li><strong>Business transfers:</strong> in connection with a merger, acquisition, financing, or sale of our business, with
          notice to affected parties as required by law.</li>
          <li><strong>Protection of rights and safety:</strong> where necessary to prevent fraud, protect platform security, or protect
          the rights and safety of Coldpilot, our Users, or the public.</li>
        </ul>
      </div>

      <div className="section" id="google-data">
        <h2>6. Use of Google Gmail Data</h2>
        <p>
          Coldpilot&apos;s use and transfer of information received from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          When you connect a Gmail inbox through Google OAuth, we access your Gmail account solely to perform the functions you request:
          sending outreach emails on your behalf and reading replies and threads to detect responses and keep your campaign conversations
          accurate. This access is limited to the minimum scopes required (send, read, and modify your own Gmail messages and threads).
        </p>
        <p>
          Specifically, we may read and write to your Gmail messages and threads for the purpose of sending, tracking, and mirroring your
          outreach conversations. We do not read the full content of unrelated messages for advertising or other unrelated purposes. We
          do not sell Gmail data or transfer it to third parties except as necessary to operate the service (e.g., storing it on our
          encrypted servers) or as required by law.
        </p>
        <p>
          Gmail data is used only for providing and improving the Coldpilot service. You can disconnect your Gmail account at any time
          from your dashboard. Data may be retained while your account is active or as required for legal and security purposes, and is
          deleted when you close your account or remove the connected mailbox.
        </p>
      </div>

      <div className="section" id="retention">
        <h2>7. Data Retention</h2>
        <p>We retain personal data for as long as necessary to fulfil the purposes described in this policy and to comply with our legal
        obligations. Key retention periods include:</p>
        <ul>
          <li><strong>Account data:</strong> for the duration of your active account and a reasonable period thereafter for legal and
          operational purposes.</li>
          <li><strong>Campaign and recipient data:</strong> for the duration of your account or until you delete them from your
          dashboard, subject to legal retention requirements.</li>
          <li><strong>Billing records:</strong> as required by applicable tax and accounting law.</li>
          <li><strong>Log and analytics data:</strong> for a limited period (typically 30&ndash;90 days) unless retained for security
          investigations.</li>
          <li><strong>Marketing data:</strong> until you opt out or request deletion.</li>
        </ul>
        <p>Upon expiration of applicable retention periods, we will securely delete or anonymize your data.</p>
      </div>

      <div className="section" id="cookies">
        <h2>8. Cookies and Tracking Technologies</h2>
        <p>We use cookies and similar technologies (pixel tags, web beacons, local storage) on our website and dashboard for the following
        purposes:</p>
        <ul>
          <li><strong>Essential cookies:</strong> required for platform functionality, authentication, and security. These cannot be
          disabled without affecting the Services.</li>
          <li><strong>Functional cookies:</strong> remember your preferences and settings across sessions.</li>
          <li><strong>Analytics cookies:</strong> help us understand how visitors and Users use our platform.</li>
          <li><strong>Security cookies:</strong> used for fraud detection and protection against unauthorized access.</li>
        </ul>
        <p>You can manage cookie preferences through your browser settings. Disabling essential cookies may affect platform
        functionality.</p>
      </div>

      <div className="section" id="security">
        <h2>9. Data Security</h2>
        <p>We implement appropriate technical and organizational measures to protect personal data against unauthorized access, alteration,
        disclosure, or destruction. Our security measures include:</p>
        <ul>
          <li>Encryption of data in transit (TLS) and at rest.</li>
          <li>Access controls limiting data access to personnel who require it for their role.</li>
          <li>Secure credential storage for connected email accounts.</li>
          <li>Regular security assessments and incident response procedures.</li>
          <li>Two-factor authentication where supported.</li>
        </ul>
        <p>No method of transmission over the Internet or electronic storage is 100% secure, but we work to protect your data.</p>
      </div>

      <div className="section" id="transfers">
        <h2>10. International Data Transfers</h2>
        <p>
          Coldpilot is headquartered in the United States. In the course of providing our Services, personal data may be transferred to
          and processed in other countries where our infrastructure, email delivery, and service providers are located. Where required,
          these transfers rely on contractual safeguards, including standard contractual clauses, or other approved transfer mechanisms.
        </p>
      </div>

      <div className="section" id="your-rights">
        <h2>11. Your Rights</h2>
        <p>Subject to applicable law, you have the following rights in relation to your personal data:</p>
        <ul>
          <li><strong>Right to access:</strong> request a copy of the personal data we hold about you.</li>
          <li><strong>Right to rectification:</strong> request correction of inaccurate or incomplete data.</li>
          <li><strong>Right to deletion:</strong> request erasure of your data, subject to legal retention obligations.</li>
          <li><strong>Right to data portability:</strong> request your data in a structured, machine-readable format.</li>
          <li><strong>Right to object:</strong> object to certain processing activities, including direct marketing.</li>
          <li><strong>Right to restriction:</strong> request that we restrict processing in certain circumstances.</li>
          <li><strong>Right to withdraw consent:</strong> where processing is consent-based, withdraw it at any time without affecting the
          lawfulness of prior processing.</li>
          <li><strong>Right to complain:</strong> lodge a complaint with your local data protection authority.</li>
        </ul>
        <p>
          Contact us at <a href="mailto:hello@mail.usecoldpilot.com">hello@mail.usecoldpilot.com</a> to exercise these rights. We will
          respond within 30 days. We may need to verify your identity before processing your request.
        </p>
      </div>

      <div className="section" id="children">
        <h2>12. Children&apos;s Privacy</h2>
        <p>
          Our Services are directed to businesses and are not intended for individuals under the age of 18. We do not knowingly collect
          personal data from minors. If you believe we have inadvertently collected data from a minor, please contact us immediately at{" "}
          <a href="mailto:hello@mail.usecoldpilot.com">hello@mail.usecoldpilot.com</a> and we will take prompt steps to delete it.
        </p>
      </div>

      <div className="section" id="third-party">
        <h2>13. Third-Party Sites and Services</h2>
        <p>
          Our platform may contain links to third-party websites or integrations. This Privacy Policy does not apply to those third
          parties. We encourage you to review the privacy policies of any third-party services you access through our platform.
        </p>
      </div>

      <div className="section" id="changes">
        <h2>14. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time as our Services evolve or as required by law. When we make material changes,
          we will notify you by email or by posting a prominent notice on our website. The effective date at the top of this document
          reflects the date of the most recent revision. Your continued use of the Services after changes are posted constitutes your
          acceptance of the updated policy.
        </p>
      </div>

      <div className="section" id="contact">
        <h2>15. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or the way we handle your data, contact us at{" "}
          <a href="mailto:hello@mail.usecoldpilot.com">hello@mail.usecoldpilot.com</a>.
        </p>
      </div>
    </LegalLayout>
  );
}