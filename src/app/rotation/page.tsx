import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Multi-inbox rotation",
  description: "Connect as many inboxes as you want. Sends spread across all of them so no single address carries the volume — or the risk.",
  alternates: { canonical: "/rotation" },
};

export default function RotationPage() {
  return (
    <MarketingPage
      label="Rotation"
      title={<>More inboxes.<br /><em style={{ fontStyle: "italic" }}>Same send volume.</em></>}
      desc="Connect as many inboxes as you want. Sends spread across all of them so no single address carries the volume — or the risk."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Volume is a team sport.</h2>
          <p>Rotating across multiple addresses keeps each inbox under the per-sender thresholds that keep mail out of spam. Add a mailbox and the engine rebalances automatically.</p>
          <ul>
            <li>Unlimited connected inboxes on every paid plan</li>
            <li>Sends spread automatically across all addresses</li>
            <li>Per-inbox daily limits respected out of the box</li>
            <li>Healthy senders stay healthy, even at scale</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
