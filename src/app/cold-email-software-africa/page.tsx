import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Cold Email Software for Africa — Multi-Currency & Local Time — Cold Pilot",
  description:
    "Cold email software for African founders and sales teams — multi-currency billing (NGN/USD), warmup scheduled to your time zone, and rotation across Gmail and Outlook inboxes.",
  alternates: { canonical: "/cold-email-software-africa" },
};

export default function AfricaPage() {
  return (
    <MarketingPage
      label="Africa"
      title={<>Cold email software for Africa.<br />Your inboxes, your time.</>}
      desc="Run cold email from your Gmail and Outlook inboxes with warmup and rotation tuned to African business hours."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Built for how African teams send.</h2>
          <p>Cold Pilot works with the inboxes you already use. Every connected address warms up, and sending is spread across all of them so no single inbox carries the volume — or the risk.</p>
          <ul>
            <li>Pay in naira or USD, whichever suits your business</li>
            <li>Warmup follows your local workday, not a US default</li>
            <li>Rotate across as many Gmail and Outlook inboxes as you need</li>
            <li>Automated campaigns with reply detection that stops a lead once they answer</li>
            <li>Warm the day your warmup resets to match your calendar</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
