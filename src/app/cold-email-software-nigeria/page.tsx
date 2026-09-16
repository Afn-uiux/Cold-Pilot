import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Cold Email Software for Nigeria — NGN Pricing",
  description:
    "Cold email software built for Nigerian teams — pay in naira, run warmup on Lagos time, and manage Gmail/Outlook inboxes from one dashboard.",
  alternates: { canonical: "/cold-email-software-nigeria" },
};

export default function NigeriaPage() {
  return (
    <MarketingPage
      label="Nigeria"
      title={<>Cold email software for Nigeria.<br />Naira pricing, Lagos time.</>}
      desc="Send cold email from your Nigerian Gmail and Outlook inboxes with warmup scheduled to your timezone and billing in naira."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Built to run on Nigerian time.</h2>
          <p>Cold Pilot is cold email software for Nigerian founders and sales teams. You connect the inboxes you already use — Gmail and Outlook — and the platform handles warmup, rotation, and sending.</p>
          <ul>
            <li>Billed in naira — no tricky USD conversions for Nigerian teams</li>
            <li>Warmup runs on Lagos/Africa time so it matches when you work</li>
            <li>Set the day your warmup resets to match your local week</li>
            <li>Use your own Nigerian Gmail or Outlook inboxes — no extra accounts to buy</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
