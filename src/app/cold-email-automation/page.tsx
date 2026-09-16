import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Cold Email Automation — Campaigns That Run Themselves",
  description:
    "Automate your entire cold email flow — warmup, inbox rotation, sequence scheduling, and reply-triggered follow-up — from one dashboard.",
  alternates: { canonical: "/cold-email-automation" },
};

export default function AutomationPage() {
  return (
    <MarketingPage
      label="Automation"
      title={<>Cold email automation.<br />Set the sequence. Let it run.</>}
      desc="Connect your inboxes, write the sequence once, and let Cold Pilot handle warmup, rotation, scheduling, and reply detection from there."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Every step runs in the background.</h2>
          <p>Cold Pilot automates the busywork around cold email — the parts that otherwise eat hours and tank deliverability if you do them by hand.</p>
          <ul>
            <li>Automated warmup starts the moment you connect an inbox</li>
            <li>Sequence scheduling sends on a calendar you define, with human pacing</li>
            <li>Inbox rotation spreads sends so one address never carries the volume</li>
            <li>Reply detection stops the sequence the moment a lead answers</li>
            <li>Follow-ups pause after a reply so you never chase someone who already said yes</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
