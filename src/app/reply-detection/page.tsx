import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Reply detection",
  description: "The moment a lead replies, books, or bounces, their sequence stops. No awkward follow-up after they've already answered.",
  alternates: { canonical: "/reply-detection" },
};

export default function ReplyDetectionPage() {
  return (
    <MarketingPage
      label="Detection"
      title={<>Stop the sequence<br /><em style={{ fontStyle: "italic" }}>the moment they reply.</em></>}
      desc="The moment a lead replies, books, or bounces, their sequence stops. No awkward follow-up after they've already answered."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Your leads talk. You just stop sending.</h2>
          <p>Coldpilot watches every connected inbox. When a contact responds — or bounces — the engine pauses their sequence instantly, so follow-ups never stack on top of a conversation that&apos;s already happening.</p>
          <ul>
            <li>Reply detection on Gmail &amp; Outlook automatically</li>
            <li>Sequence stops for a lead the second they respond</li>
            <li>Bounces suppressed so you never email a dead address again</li>
            <li>Replying yourself keeps the thread in your normal inbox</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
