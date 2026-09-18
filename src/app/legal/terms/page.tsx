import type { Metadata } from "next";
import LegalLayout, { type LegalSection } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "ColdPilot's terms of service — the rules and conditions governing the use of our cold email outreach platform.",
  alternates: { canonical: "/legal/terms" },
};

const SECTIONS: LegalSection[] = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "definitions", label: "2. Definitions" },
  { id: "eligibility", label: "3. Eligibility and Accounts" },
  { id: "the-service", label: "4. Our Services" },
  { id: "responsibilities", label: "5. Your Responsibilities" },
  { id: "acceptable-use", label: "6. Acceptable Use" },
  { id: "fees", label: "7. Fees and Payment" },
  { id: "connected-accounts", label: "8. Connected Email Accounts" },
  { id: "recipient-data", label: "9. Recipient Data" },
  { id: "verification", label: "10. Verification and Deliverability" },
  { id: "third-party", label: "11. Third-Party Services" },
  { id: "ip", label: "12. Intellectual Property" },
  { id: "confidentiality", label: "13. Confidentiality" },
  { id: "privacy", label: "14. Privacy" },
  { id: "suspension", label: "15. Suspension and Termination" },
  { id: "downtime", label: "16. Availability" },
  { id: "disclaimers", label: "17. Disclaimers" },
  { id: "liability", label: "18. Limitation of Liability" },
  { id: "indemnity", label: "19. Indemnity" },
  { id: "changes", label: "20. Changes to These Terms" },
  { id: "disputes", label: "21. Dispute Resolution" },
  { id: "governing-law", label: "22. Governing Law" },
  { id: "misc", label: "23. General Terms" },
  { id: "contact", label: "24. Contact" },
];

export default function TermsPage() {
  return (
    <LegalLayout doc="terms" sections={SECTIONS}>
      <h1>Terms of Service</h1>
      <p className="effective-date">Effective Date: September 5, 2026</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the ColdPilot platform, website, APIs, and all
        related services (collectively, the &ldquo;Services&rdquo;). ColdPilot, Inc. (&ldquo;ColdPilot&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;, or &ldquo;our&rdquo;) provides cold email outreach software designed to help businesses run compliant,
        deliverable outreach at scale.
      </p>
      <p>
        Please read these Terms carefully before using the Services. By creating an account, accessing the website, or using any part of
        the Services, you agree to be bound by these Terms. If you are using the Services on behalf of a company or organization, you
        represent that you have authority to bind that entity.
      </p>

      <div className="section" id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the Services, you agree to these Terms, our <a href="/legal/privacy">Privacy Policy</a>, and our{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>. If you do not agree to all of these documents, you may not use the
          Services.
        </p>
      </div>

      <div className="section" id="definitions">
        <h2>2. Definitions</h2>
        <ul>
          <li><strong>&ldquo;Account&rdquo;</strong> means the registered account you create to access the Services.</li>
          <li><strong>&ldquo;ColdPilot&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>, <strong>&ldquo;us&rdquo;</strong>, or{" "}
          <strong>&ldquo;our&rdquo;</strong> means ColdPilot, Inc.</li>
          <li><strong>&ldquo;User&rdquo;</strong>, <strong>&ldquo;you&rdquo;</strong>, or <strong>&ldquo;your&rdquo;</strong> means the
          individual or entity using the Services.</li>
          <li><strong>&ldquo;Services&rdquo;</strong> means all software, websites, dashboards, APIs, tools, content, and documentation
          provided by ColdPilot.</li>
          <li><strong>&ldquo;Connected Account&rdquo;</strong> means an email account (Gmail, Google Workspace, Outlook, or an SMTP host)
          that you connect to the Services to send and receive email.</li>
          <li><strong>&ldquo;Campaign&rdquo;</strong> means an outreach sequence, warm-up, rotation, or related workflow you create using
          the Services.</li>
          <li><strong>&ldquo;Recipient Data&rdquo;</strong> means email addresses and related information you import into the Services and
          information we process in connection with sending, delivering, and detecting replies to email.</li>
          <li><strong>&ldquo;Applicable Law&rdquo;</strong> means all laws, regulations, and requirements applicable to your use of the
          Services, including data protection and anti-spam laws.</li>
        </ul>
      </div>

      <div className="section" id="eligibility">
        <h2>3. Eligibility and Accounts</h2>
        <ul>
          <li>You must be at least 18 years old and capable of forming a binding contract to create an Account.</li>
          <li>You must provide accurate, current, and complete information when registering and keep it up to date.</li>
          <li>You are responsible for safeguarding your password and for all activity that occurs under your Account.</li>
          <li>You may not create multiple accounts to circumvent trial or free-tier limits, abuse our systems, or evade a suspension.</li>
          <li>We may verify your identity or connected email accounts as required to provide the Services and comply with our legal
          obligations.</li>
        </ul>
      </div>

      <div className="section" id="the-service">
        <h2>4. Our Services</h2>
        <p>ColdPilot provides cold email outreach tools, including but not limited to:</p>
        <ul>
          <li>Campaign creation, sequencing, scheduling, and management;</li>
          <li>Inbox warm-up to improve sender reputation and deliverability;</li>
          <li>Account rotation and sending limits to protect your domains and inboxes;</li>
          <li>Reply detection and conversation tracking;</li>
          <li>Email list verification;</li>
          <li>Analytics, performance, and deliverability reporting.</li>
        </ul>
        <p>
          We may modify, add, or remove features and functionality at any time. We will use commercially reasonable efforts to provide
          the Services in accordance with their published descriptions but do not guarantee that specific results (such as a particular
          open rate, reply rate, or deliverability outcome) will be achieved.
        </p>
      </div>

      <div className="section" id="responsibilities">
        <h2>5. Your Responsibilities</h2>
        <p>You are solely responsible for your use of the Services, your Campaigns, and the Recipient Data you provide. You agree to:</p>
        <ul>
          <li>Comply with all Applicable Laws, including the CAN-SPAM Act, GDPR, the UK GDPR, CCPA, and equivalent anti-spam and privacy
          laws in your jurisdiction;</li>
          <li>Maintain the accuracy of the information you provide and import;</li>
          <li>Ensure you have the rights and, where required, the lawful basis and consent to contact the recipients you target;</li>
          <li>Configure your Connected Accounts with appropriate sending limits and honor opt-out and suppression requests;</li>
          <li>Keep your account credentials secure and promptly notify us of any suspected unauthorized access;</li>
          <li>Ensure your emails include accurate sender identification and, where required, a valid physical postal address and
          opt-out mechanism;</li>
          <li>Monitor and be responsible for material sent through your Connected Accounts, even when automated.</li>
        </ul>
      </div>

      <div className="section" id="acceptable-use">
        <h2>6. Acceptable Use</h2>
        <p>
          You may not use the Services in violation of our <a href="/legal/acceptable-use">Acceptable Use Policy</a>, which is part of
          these Terms. Without limiting that policy, you may not:
        </p>
        <ul>
          <li>Send unsolicited bulk or spam email, or purchase, rent, or otherwise use lists without demonstrable rights;</li>
          <li>Send phishing, malware, fraudulent, or misleading content;</li>
          <li>Impersonate others or use deceptive sender identities;</li>
          <li>Attempt to damage, overload, or interfere with the Services or other users&apos; accounts;</li>
          <li>Circumvent, probe, or bypass any security, rate, or abuse-control measures;</li>
          <li>Use the Services for any unlawful purpose or in any manner that could damage our reputation.</li>
        </ul>
      </div>

      <div className="section" id="fees">
        <h2>7. Fees and Payment</h2>
        <ul>
          <li><strong>Plans:</strong> the Services are offered under subscription plans or usage-based pricing as displayed on our
          website. Prices may change over time with prior notice.</li>
          <li><strong>Billing:</strong> fees are due in advance for the applicable billing period and are processed by our third-party
          payment processor.</li>
          <li><strong>Automatic renewal:</strong> subscriptions renew automatically at the end of each billing period unless you cancel
          before the renewal date.</li>
          <li><strong>Cancellation:</strong> you may cancel anytime through your dashboard. Your plan remains active until the end of the
          current billing period.</li>
          <li><strong>Refunds:</strong> except as required by law, fees are non-refundable. We may, at our discretion, offer credits or
          refunds in cases of service failure.</li>
          <li><strong>Taxes:</strong> you are responsible for all taxes associated with your use of the Services, excluding taxes based
          on our net income.</li>
          <li>If fees are not paid when due, we simply limit the account to free-tier features until the subscription is brought
          back up to date. We do not suspend or terminate accounts for non-payment.</li>
        </ul>
      </div>

      <div className="section" id="connected-accounts">
        <h2>8. Connected Email Accounts</h2>
        <ul>
          <li>
            To send email, you connect one or more email accounts. When you connect an account via OAuth (Gmail, Google Workspace,
            Outlook), we access that account only to the extent necessary to provide the Services, under the permissions you grant.
          </li>
          <li>
            When you connect a Gmail account, our use of data received from Google APIs complies with the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">
              Google API Services User Data Policy
            </a>{" "}
            including its Limited Use requirements, as described in our <a href="/legal/privacy">Privacy Policy</a>.
          </li>
          <li>You are responsible for the configuration and sending limits of your Connected Accounts and for complying with the
          provider&apos;s terms of service.</li>
          <li>If a Connected Account is suspended or discontinued by its provider, we are not liable for resulting disruptions.</li>
        </ul>
      </div>

      <div className="section" id="recipient-data">
        <h2>9. Recipient Data</h2>
        <ul>
          <li><strong>Your data:</strong> Recipient Data you import remains yours. You are the data controller of that data, and we act
          as a processor on your behalf.</li>
          <li><strong>Processing:</strong> we process Recipient Data solely to provide the Services to you: sending campaigns, detecting
          replies, verifying addresses, and reporting analytics.</li>
          <li><strong>Representations:</strong> you represent that you hold Recipient Data lawfully and have any necessary rights,
          permissions, and lawful bases to process it, including contacting recipients via ColdPilot.</li>
          <li><strong>Sensitive data:</strong> you will not upload sensitive or special-category personal data (e.g., health, biometric,
          or government identifiers) without our prior written consent.</li>
          <li><strong>Deletion:</strong> you can delete Recipient Data from your dashboard at any time. After account closure, we will
          delete or anonymize Recipient Data within a reasonable period, subject to legal retention requirements.</li>
        </ul>
      </div>

      <div className="section" id="verification">
        <h2>10. Verification and Deliverability</h2>
        <ul>
          <li>We provide tools such as email verification and warm-up to improve deliverability. These tools are provided on a
          best-efforts basis and we do not guarantee the accuracy of verification results.</li>
          <li>Deliverability depends on many factors outside our control, including the reputation of your domains, IPs, and Connected
          Accounts, and the practices of email providers and spam filters.</li>
          <li>You should validate important verification decisions with your own testing before relying on them.</li>
        </ul>
      </div>

      <div className="section" id="third-party">
        <h2>11. Third-Party Services</h2>
        <ul>
          <li>The Services may integrate with or rely on third-party providers (e.g., email delivery infrastructure, payment processors,
          verification services, and AI providers).</li>
          <li>We are not responsible for the availability, functionality, or policies of third-party services, except as required by law
          or as expressly agreed with the relevant provider.</li>
          <li>Your use of any third-party services through our platform is subject to those providers&apos; own terms and policies.</li>
        </ul>
      </div>

      <div className="section" id="ip">
        <h2>12. Intellectual Property</h2>
        <ul>
          <li><strong>Our IP:</strong> the Services, including all software, design, text, graphics, logos, documentation, and
          underlying technology, are owned by ColdPilot or its licensors and are protected by intellectual property laws. We grant you a
          limited, non-exclusive, non-transferable, revocable license to use the Services for your internal business purposes, subject to
          these Terms.</li>
          <li><strong>Your IP:</strong> you retain all rights to your Campaign content and your Recipient Data. By using the Services,
          you grant us a limited license to process, store, and transmit that data solely to provide the Services.</li>
          <li><strong>Feedback:</strong> if you provide us with suggestions, ideas, or feedback, you grant us a perpetual,
          irrevocable, non-exclusive license to use them without obligation to you.</li>
          <li>You may not copy, modify, reverse engineer, resell, or create derivative works of the Services, except as permitted by
          law or with our prior written consent.</li>
        </ul>
      </div>

      <div className="section" id="confidentiality">
        <h2>13. Confidentiality</h2>
        <p>
          Each party will protect the other&apos;s Confidential Information (non-public business, technical, or commercial information
          disclosed in connection with the Services) using reasonable care, and will not disclose it except to personnel bound by
          confidentiality obligations or as required by law. This obligation survives termination of these Terms.
        </p>
      </div>

      <div className="section" id="privacy">
        <h2>14. Privacy</h2>
        <p>
          Our collection and use of personal data is described in our <a href="/legal/privacy">Privacy Policy</a>, which forms part of
          these Terms. By using the Services, you acknowledge that you have read and understood the Privacy Policy.
        </p>
      </div>

      <div className="section" id="suspension">
        <h2>15. Suspension and Termination</h2>
        <ul>
          <li><strong>By You:</strong> you may terminate your Account at any time from your dashboard or by contacting us.</li>
          <li><strong>By Us:</strong> we may suspend or terminate your Account if you breach these Terms, the Acceptable Use Policy, or
          Applicable Law; if we suspect abuse, fraud, or unauthorized activity; or as required by law.</li>
          <li><strong>Effect:</strong> upon termination, your access to the Services ceases. We will delete or anonymize your data within
          a reasonable period, subject to legal retention obligations.</li>
          <li>We will make reasonable efforts to notify you before terminating a non-urgent account.</li>
        </ul>
      </div>

      <div className="section" id="downtime">
        <h2>16. Availability</h2>
        <p>
          We aim to provide reliable service but do not guarantee uninterrupted or error-free availability. Periodic maintenance,
          upgrades, or events outside our control may cause downtime. Except as required by law, we are not liable for damages arising
          from service interruptions.
        </p>
      </div>

      <div className="section" id="disclaimers">
        <h2>17. Disclaimers</h2>
        <ul>
          <li>The Services are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express,
          implied, statutory, or otherwise, including warranties of merchantability, fitness for a particular purpose, non-infringement,
          or results.</li>
          <li>We do not warrant that the Services will meet your requirements, operate without interruption, or that results (including
          deliverability, reply rates, or verification accuracy) will be as expected.</li>
          <li>To the maximum extent permitted by law, we disclaim all liability arising from the sending of email by you, including any
          recipient complaints or legal claims relating to your outreach.</li>
        </ul>
      </div>

      <div className="section" id="liability">
        <h2>18. Limitation of Liability</h2>
        <ul>
          <li>To the maximum extent permitted by law, ColdPilot&apos;s aggregate liability for all claims arising out of or relating to
          these Terms or your use of the Services is limited to the amounts you paid to us in the twelve (12) months preceding the event
          giving rise to the claim.</li>
          <li>In no event will ColdPilot be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost
          profits, data, goodwill, or business opportunities, even if advised of the possibility of such damages.</li>
          <li>To the extent applicable law does not permit these limitations, liability will be limited to the maximum extent permitted.</li>
        </ul>
      </div>

      <div className="section" id="indemnity">
        <h2>19. Indemnity</h2>
        <p>
          You will defend, indemnify, and hold harmless ColdPilot and its officers, directors, employees, and agents from and against any
          claims, damages, liabilities, costs, and expenses (including reasonable legal fees) arising out of or relating to: (a) your use
          of the Services; (b) your Campaigns or Recipient Data; (c) your breach of these Terms or the Acceptable Use Policy; or
          (d) your violation of Applicable Law or the rights of any third party.
        </p>
      </div>

      <div className="section" id="changes">
        <h2>20. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be announced by email or prominent notice on our website at
          least thirty (30) days before they take effect unless a change is required by law or in an emergency. Continued use of the
          Services after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </div>

      <div className="section" id="disputes">
        <h2>21. Dispute Resolution</h2>
        <ul>
          <li>We encourage you to contact us first at <a href="mailto:hello@mail.usecoldpilot.com">hello@mail.usecoldpilot.com</a> to
          resolve any concern informally.</li>
          <li>Where permitted by law, disputes will be resolved individually (no class actions), by negotiation, and if unresolved, in
          the courts of the jurisdiction set out below, consistently with the governing-law provision.</li>
        </ul>
      </div>

      <div className="section" id="governing-law">
        <h2>22. Governing Law</h2>
        <p>
          These Terms and any disputes arising out of or relating to them will be governed by and construed in accordance with the laws of
          the State of Delaware, United States, without regard to its conflict-of-law principles. Any legal action arising out of these
          Terms will be brought in the state or federal courts located in Delaware, and the parties consent to the exclusive jurisdiction
          of those courts, subject to applicable consumer protections required by law.
        </p>
      </div>

      <div className="section" id="misc">
        <h2>23. General Terms</h2>
        <ul>
          <li><strong>Entire agreement:</strong> these Terms, together with the Privacy Policy and Acceptable Use Policy, constitute the
          entire agreement between you and ColdPilot regarding the Services.</li>
          <li><strong>Severability:</strong> if any provision is held invalid or unenforceable, the remainder will continue in full force
          and effect.</li>
          <li><strong>Waiver:</strong> our failure to enforce a provision is not a waiver of that provision.</li>
          <li><strong>Assignment:</strong> you may not assign your rights under these Terms without our prior written consent; we may
          assign our rights in connection with a business transfer.</li>
          <li><strong>No agency:</strong> nothing in these Terms creates a partnership, agency, or employment relationship.</li>
          <li><strong>Notices:</strong> we may provide notices to you by email to the address on your Account or by posting on the
          website.</li>
        </ul>
      </div>

      <div className="section" id="contact">
        <h2>24. Contact</h2>
        <p>
          Questions about these Terms? Contact us at <a href="mailto:hello@mail.usecoldpilot.com">hello@mail.usecoldpilot.com</a>.
        </p>
      </div>
    </LegalLayout>
  );
}