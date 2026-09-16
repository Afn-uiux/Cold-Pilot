import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Opens, replies, and bounces on one screen. Just what you need to know if the sequence is working.",
  alternates: { canonical: "/analytics" },
};

export default function AnalyticsPage() {
  return (
    <MarketingPage
      label="Analytics"
      title={<>Numbers you can read<br /><em style={{ fontStyle: "italic" }}>in one glance.</em></>}
      desc="Opens, replies, and bounces on one screen. Just what you need to know if the sequence is working."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Three numbers, zero guesswork.</h2>
          <p>No dashboards full of vanity metrics. Opens, replies, and bounces — per campaign, per step — so you know exactly what to change next.</p>
          <ul>
            <li>Opens, replies, and bounces on one screen</li>
            <li>Breakdown by sequence step and by inbox</li>
            <li>Spot the follow-up that stops getting replies</li>
            <li>Bounces surfaced so you can clean your list</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
