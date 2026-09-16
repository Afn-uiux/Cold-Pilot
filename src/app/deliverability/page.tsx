import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Deliverability monitor",
  description: "A spam-score check runs before every send, so you catch a flagged domain or spammy subject line before your leads do.",
  alternates: { canonical: "/deliverability" },
};

export default function DeliverabilityPage() {
  return (
    <MarketingPage
      label="Deliverability"
      title={<>Land in the inbox,<br /><em style={{ fontStyle: "italic" }}>or don&apos;t send.</em></>}
      desc="A spam-score check runs before every send, so you catch a flagged domain or spammy subject line before your leads do."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Warnings before sends, not surprises after.</h2>
          <p>Every outgoing email is scored before it leaves. A flagged domain or a spammy subject line gets caught at the gate — not in your lead&apos;s spam folder.</p>
          <ul>
            <li>Spam-score check before every single send</li>
            <li>Domain reputation tracked as you warm up</li>
            <li>Flags subject lines that read like spam</li>
            <li>Built into every plan — not an add-on</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
