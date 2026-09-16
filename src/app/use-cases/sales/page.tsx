import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Sales teams",
  description: "Distribute sends across reps and surface the positives. Cold email for sales teams.",
  alternates: { canonical: "/use-cases/sales" },
};

export default function SalesPage() {
  return (
    <MarketingPage
      label="Sales teams"
      title={<>Distribute across reps.<br /><em style={{ fontStyle: "italic" }}>Never one overloaded inbox.</em></>}
      desc="Spread volume across every rep's inbox so no single address takes the risk, and see exactly which sequences actually get replies."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Team outreach, delivered safely.</h2>
          <p>Connect every rep&apos;s inbox and let rotation spread the workload. Reply detection stops a lead&apos;s sequence the instant anyone responds, so follow-ups never trample an active conversation.</p>
          <ul>
            <li>Connect each rep&apos;s inbox in minutes</li>
            <li>Sends rotate across the whole team</li>
            <li>Reply detection per lead, automatically</li>
            <li>Open and reply rates you can actually act on</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
