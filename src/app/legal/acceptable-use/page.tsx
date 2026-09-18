import type { Metadata } from "next";
import LegalLayout, { type LegalSection } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description:
    "ColdPilot's acceptable use policy — the rules for compliant, permission-based cold email outreach on our platform.",
  alternates: { canonical: "/legal/acceptable-use" },
};

const SECTIONS: LegalSection[] = [
  { id: "overview", label: "1. Overview" },
  { id: "enforceable", label: "2. What This Policy Covers" },
  { id: "spam", label: "3. No Spam or Unsolicited Lists" },
  { id: "content", label: "4. Content Standards" },
  { id: "deception", label: "5. No Deception or Impersonation" },
  { id: "consent", label: "6. Consent, Opt-Outs, and Unsubscribes" },
  { id: "infrastructure", label: "7. No Abuse of Our Platform" },
  { id: "illegal", label: "8. No Illegal or Harmful Activity" },
  { id: "no-compete", label: "9. No Reselling or Circumvention" },
  { id: "reporting", label: "10. Reporting Violations" },
  { id: "enforcement", label: "11. Enforcement" },
];

export default function AcceptableUsePage() {
  return (
    <LegalLayout doc="acceptable-use" sections={SECTIONS}>
      <h1>Acceptable Use Policy</h1>
      <p className="effective-date">Effective Date: September 5, 2026</p>

      <p>
        ColdPilot, Inc. (&ldquo;ColdPilot&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) provides cold email outreach
        software. This Acceptable Use Policy (&ldquo;AUP&rdquo;) sets out the standards you must follow when using our Services. It
        applies to all users, free and paid, and forms part of our <a href="/legal/terms">Terms of Service</a>.
      </p>
      <p>
        ColdPilot is built to help businesses run professional, compliant outreach that protects both senders and recipients. We take
        spam, deception, and abuse seriously. We review activity on our platform and enforce this policy consistently.
      </p>

      <div className="section" id="overview">
        <h2>1. Overview</h2>
        <p>
          In short: use ColdPilot to send relevant, honest outreach to people who may reasonably expect to hear from you, honor every
          opt-out, and never use our platform to mislead, harass, or harm anyone. If your practices would get your own domain blacklisted,
          they have no place on our platform.
        </p>
      </div>

      <div className="section" id="enforceable">
        <h2>2. What This Policy Covers</h2>
        <p>This AUP applies to all aspects of the Services, including:</p>
        <ul>
          <li>Campaigns, sequences, and automated sending;</li>
          <li>Inbox warm-up and sending limit configuration;</li>
          <li>Connected email accounts and the messages sent through them;</li>
          <li>Imported recipient lists and email verification;</li>
          <li>APIs and any other means of accessing our platform;</li>
          <li>Content you generate with our AI-assisted tools.</li>
        </ul>
      </div>

      <div className="section" id="spam">
        <h2>3. No Spam or Unsolicited Lists</h2>
        <ul>
          <li>You may not use ColdPilot to send unsolicited bulk email, chain mail, or spam of any kind.</li>
          <li>You may not purchase, rent, scrape, or otherwise import recipient lists unless you have a lawful basis and reasonable
          grounds to contact every person on the list.</li>
          <li>You may not use the Services to harvest email addresses or build lists from data you do not own or legitimately license.</li>
          <li>You should send only to recipients with whom you have a business relationship, potential interest, or lawful consent, and
          should follow established cold-email best practices, including honest subject lines, a concise relevant message, and a working
          opt-out in every email.</li>
          <li>You may not use verified-address data to send to people who have explicitly stated they do not wish to be contacted.</li>
        </ul>
      </div>

      <div className="section" id="content">
        <h2>4. Content Standards</h2>
        <p>You may not send, facilitate, or otherwise transmit through the Services:</p>
        <ul>
          <li>Phishing, malware, ransomware, or exploits;</li>
          <li>Credit-card fraud, identity theft, or credentials-harvesting content;</li>
          <li>Misleading financial offers, gambling, pharmaceutical, or get-rich-quick schemes;</li>
          <li>Pornography, sexualized content, or content exploiting minors;</li>
          <li>Hate speech, harassment, threats, or content promoting violence or discrimination;</li>
          <li>Material that violates the intellectual property, privacy, or other rights of any third party;</li>
          <li>Content that is otherwise unlawful, or that would bring ColdPilot&apos;s infrastructure or reputation into disrepute.</li>
        </ul>
      </div>

      <div className="section" id="deception">
        <h2>5. No Deception or Impersonation</h2>
        <ul>
          <li>Sender identity must be truthful: the &ldquo;From&rdquo; name and address must accurately identify you or your business.</li>
          <li>You may not impersonate another person, company, or brand, or use misleading reply-to or routing information.</li>
          <li>Subject lines and content must not be deceptive or misleading about their purpose.</li>
          <li>You may not use our platform to bypass spam filters or other providers&apos; abuse controls, including by altering wording
          solely to evade filtering.</li>
        </ul>
      </div>

      <div className="section" id="consent">
        <h2>6. Consent, Opt-Outs, and Unsubscribes</h2>
        <ul>
          <li>You must comply with all Applicable Laws governing consent and marketing, including CAN-SPAM, GDPR, and CCPA where they
          apply to you.</li>
          <li>Every email you send must include a functional, easy-to-find way to opt out of future messages, and you must honor opt-out
          requests promptly and permanently.</li>
          <li>Your sending must not continue to contact recipients who have unsubscribed, bounced, replied with &ldquo;stop&rdquo; or
          &ldquo;take me off&rdquo;, or otherwise signaled they do not want to hear from you.</li>
          <li>ColdPilot&apos;s suppression and reply-detection tools are provided to help you honor these requests; you are responsible
          for using them.</li>
        </ul>
      </div>

      <div className="section" id="infrastructure">
        <h2>7. No Abuse of Our Platform</h2>
        <ul>
          <li>You may not overload, degrade, or interfere with our infrastructure, other users, or third parties.</li>
          <li>You may not circumvent sending limits, warm-up thresholds, or other platform safeguards, or create multiple accounts to
          avoid limits or bans.</li>
          <li>You may not probe, scan, or test the vulnerability of the Services except as expressly authorized.</li>
          <li>You may not use the Services in a manner that could harm the sending reputation of our shared or your dedicated
          infrastructure.</li>
        </ul>
      </div>

      <div className="section" id="illegal">
        <h2>8. No Illegal or Harmful Activity</h2>
        <ul>
          <li>You may not use the Services in connection with any unlawful activity or in violation of any export, sanctions, or
          anti-money-laundering laws.</li>
          <li>You may not use the Services to violate the terms of service of any email provider (including Gmail and Google Workspace)
          or any service you connect.</li>
          <li>You may not process special-category or sensitive personal data through the Services, or upload Recipient Data obtained
          without a lawful basis.</li>
        </ul>
      </div>

      <div className="section" id="no-compete">
        <h2>9. No Reselling or Circumvention</h2>
        <ul>
          <li>You may not resell, sublicense, lease, or provide the Services to third parties as a hosted or white-label service without
          our prior written consent.</li>
          <li>You may not use the Services to mirror or replicate ColdPilot&apos;s functionality for a competing service.</li>
          <li>You may not scrape our website, dashboard, or API beyond normal use of the Services.</li>
        </ul>
      </div>

      <div className="section" id="reporting">
        <h2>10. Reporting Violations</h2>
        <p>
          If you believe someone is violating this AUP, please report it to us at{" "}
          <a href="mailto:report@mail.usecoldpilot.com">report@mail.usecoldpilot.com</a>. We investigate reports promptly and may take
          action as described below while keeping reports confidential where possible.
        </p>
      </div>

      <div className="section" id="enforcement">
        <h2>11. Enforcement</h2>
        <ul>
          <li>We may suspend or terminate any Account we believe is violating this AUP or the <a href="/legal/terms">Terms of
          Service</a>, in our sole discretion and without prior notice where necessary.</li>
          <li>Depending on the severity of the violation, we may issue a warning, throttle or restrict sending, disable specific
          features, suspend the Account, or permanently terminate the Services.</li>
          <li>We may preserve records of potentially unlawful activity and share them with law enforcement or regulatory authorities as
          required by law.</li>
          <li>Violations that result in termination do not automatically entitle you to a refund of prepaid fees, subject to applicable
          law.</li>
          <li>We may update this AUP from time to time. Continued use of the Services after changes are posted constitutes acceptance of
          the updated policy.</li>
        </ul>
      </div>
    </LegalLayout>
  );
}