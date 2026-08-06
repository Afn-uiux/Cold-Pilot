import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Recruiters — Coldpilot",
  description: "Candidate outreach from personal mailboxes. Sequence stops the moment a candidate answers.",
};

export default function RecruitersPage() {
  return (
    <MarketingPage
      label="Recruiters"
      title={<>Candidate outreach<br /><em style={{ fontStyle: "italic" }}>from a real inbox.</em></>}
      desc="Warm your personal mailbox, then reach candidates with a sequence that stops the moment they answer — before the follow-ups get awkward."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Talent won&apos;t reply to a sender in spam.</h2>
          <p>Recruiters send from personal mailboxes, which makes deliverability fragile. Coldpilot warms that address, rotates the load, and watches for replies so your next steps come from a human, not an autoresponder.</p>
          <ul>
            <li>Warm the address you actually recruit from</li>
            <li>Sequence stops the instant a candidate replies</li>
            <li>Personalization tokens for role and company</li>
            <li>No per-mailbox fees, connect as many as you run</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
