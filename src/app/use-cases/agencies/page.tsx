import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Agencies — Coldpilot",
  description: "Outbound for many clients on many domains. Multi-inbox rotation and unlimited inboxes for agencies.",
};

export default function AgenciesPage() {
  return (
    <MarketingPage
      label="Agencies"
      title={<>Many clients.<br /><em style={{ fontStyle: "italic" }}>Many domains.</em></>}
      desc="Run outbound for multiple clients without mixing volume or burning a domain. Each client's inboxes stay separate, each stays healthy."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>One tool for every client account.</h2>
          <p>Agencies manage multiple domains and mailboxes under one account. Rotation and warm-up keep every client&apos;s inbox placement high, and per-account limits protect the whole portfolio.</p>
          <ul>
            <li>Unlimited inboxes across all your clients</li>
            <li>Keep client sends separate and healthy</li>
            <li>Reply detection that stops sequences per lead</li>
            <li>Agency tier with white-label &amp; API access</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
