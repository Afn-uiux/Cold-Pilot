import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Personalization tokens — Coldpilot",
  description: "Pull first name, company, or any custom field into the subject line and body — no manual find-and-replace.",
};

export default function PersonalizationPage() {
  return (
    <MarketingPage
      label="Personalization"
      title={<>Made for the person,<br /><em style={{ fontStyle: "italic" }}>not the list.</em></>}
      desc="Pull first name, company, or any custom field into the subject line and body — no manual find-and-replace."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Every email looks hand-written.</h2>
          <p>Tokens map to columns in your lead list and fill in automatically at send time. A subject that says {"{first_name}"} becomes &quot;Hi Sarah&quot; — one email at a time.</p>
          <ul>
            <li>Any column in your CSV becomes a token</li>
            <li>Works in subject lines and email bodies</li>
            <li>Fills at send time from each lead&apos;s own data</li>
            <li>Preview before launch so you know it reads right</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
