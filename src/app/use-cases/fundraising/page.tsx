import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Fundraising — Coldpilot",
  description: "A focused outreach sequence that lands in the inbox. Cold email for fundraising.",
};

export default function FundraisingPage() {
  return (
    <MarketingPage
      label="Fundraising"
      title={<>Raise by reaching inboxes,<br /><em style={{ fontStyle: "italic" }}>not spam folders.</em></>}
      desc="A focused outreach sequence that lands in the inbox. Personalize every message, follow up on the right cadence, and never annoy a fund you've already heard from."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Your warmup fund is founder@. Spend it wisely.</h2>
          <p>Fundraising runs on a small list and a big reputation. Coldpilot keeps your domain clean so the first email to a partner actually arrives, and stops the sequence the second anyone replies.</p>
          <ul>
            <li>Warm your domain before the first outreach</li>
            <li>Personalization for each fund and partner</li>
            <li>Follow-ups that stop the moment someone responds</li>
            <li>Placement stats so you know outreach is landing</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
