import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Inbox warm-up",
  description: "New inboxes send a slow, human-looking pattern for two weeks so mailbox providers learn to trust the address before your campaign starts.",
  alternates: { canonical: "/warmup" },
};

export default function WarmupPage() {
  return (
    <MarketingPage
      label="Warmup"
      title={<>Warm up the inbox.<br /><em style={{ fontStyle: "italic" }}>Not the spam folder.</em></>}
      desc="New inboxes send a slow, human-looking pattern for two weeks so mailbox providers learn to trust the address before your campaign starts."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>Trust is earned before you send a single cold email.</h2>
          <p>Every connected inbox starts a warm-up routine the moment it&apos;s linked. It ramps volume gradually, mimics a real person, and keeps reputation high so your first campaign doesn&apos;t land in spam.</p>
          <ul>
            <li>Starts automatically the moment you connect Gmail or Outlook</li>
            <li>Gradual, human-looking volume that ramps over ~2 weeks</li>
            <li>Runs quietly in the background while you build your sequence</li>
            <li>Keeps working between campaigns so placement never drops</li>
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
