import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Docs",
  description: "Documentation for Coldpilot: connecting inboxes, warm-up, rotation, and deliverability.",
  alternates: { canonical: "/docs" },
};

const topics = [
  "Connect Gmail or Outlook",
  "Warm-up and when to launch",
  "Multi-inbox rotation",
  "Personalization tokens",
  "Reply detection & auto-stop",
  "Deliverability checks",
  "Billing and credits",
];

export default function DocsPage() {
  return (
    <MarketingPage
      label="Docs"
      title={<>Guides,<br /><em style={{ fontStyle: "italic" }}>not guesswork.</em></>}
      desc="Everything you need to connect an inbox, warm it up, and launch a sequence that lands. Full docs are in progress."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Coming soon</h2>
          <p>We&apos;re writing detailed guides for each part of the product. Meanwhile, everything below runs automatically the moment you connect an inbox.</p>
          <ul>
            {topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
