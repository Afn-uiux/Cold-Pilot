import type { Metadata } from "next";
import PricingPage from "./pricing-view";
import JsonLd from "@/components/seo-jsonld";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Coldpilot pricing: a free 14-day trial, unlimited inboxes on every paid plan, and one credit balance for sending, verification and AI writing. No seat fees, no contracts.",
  openGraph: {
    title: "Pricing — Pro features, half the price",
    description:
      "Unlimited inboxes on every paid plan. AI email writing included — not sold as an add-on. No seat fees, no contracts.",
  },
};

const faqs = [
  {
    q: 'What does "unlimited inboxes" mean?',
    a: "Connect as many Gmail, Outlook, or SMTP accounts as you want on every paid plan. Sends rotate across all of them automatically.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "Campaigns pause and verification/AI stop until you buy a credit pack or upgrade. Sending costs 1 credit per email, verification 0.25 credits per check, and AI writing 2 credits per generation.",
  },
  {
    q: "Is there a free trial?",
    a: "Every new account gets 14 days free with no credit card: 2 inboxes, 300 leads, and 1,000 one-time credits to test verification. After day 14 you can still log in and see everything — you just can't send, import, verify, or use AI until you upgrade.",
  },
  {
    q: "Can I switch plans or cancel?",
    a: "Yes, any time. Downgrade or cancel in one click — no contracts, no retention flow. Yearly billing saves you two months.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <PricingPage />
    </>
  );
}