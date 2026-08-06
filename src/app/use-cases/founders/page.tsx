import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Founders — Coldpilot",
  description: "Run intro sequences without burning founder@. Cold email for solo founders and small teams.",
};

export default function FoundersPage() {
  return (
    <MarketingPage
      label="Founders"
      title={<>Cold outreach without<br /><em style={{ fontStyle: "italic" }}>burning founder@.</em></>}
      desc="Warm your personal inbox, rotate cold outreach off it, and stop the moment someone replies. Outreach that protects the address you actually live on."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Your inbox is your biggest asset. Keep it healthy.</h2>
          <p>Founders send from their own address — which is also the address investors, customers, and partners write to. Coldpilot keeps it out of spam while you run intro and follow-up sequences.</p>
          <ul>
            <li>Warm your real inbox before the first sequence</li>
            <li>Rotate sends so founder@ never carries full volume</li>
            <li>Stop the follow-ups the moment someone replies</li>
            <li>One flat price — AI and verification included</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
