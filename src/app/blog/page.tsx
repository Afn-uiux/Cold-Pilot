import type { Metadata } from "next";
import MarketingPage from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on cold email, deliverability, and building Coldpilot in public.",
  alternates: { canonical: "/blog" },
};

const posts = [
  { title: "Why your cold emails land in spam (and how to fix it)", date: "Coming soon", tag: "Deliverability" },
  { title: "Warm-up, explained without the fluff", date: "Coming soon", tag: "Warmup" },
  { title: "Rotation: the one habit that keeps sending healthy", date: "Coming soon", tag: "Rotation" },
  { title: "The follow-up that gets replies", date: "Coming soon", tag: "Sequences" },
];

export default function BlogPage() {
  return (
    <MarketingPage
      label="Blog"
      title={<>Notes from the inbox.</>}
      desc="Cold email, deliverability, and building Coldpilot in public. The first posts are on the way — tell us what to write first."
    >
      <section className="mp-body">
        <div className="wrap mp-body-inner">
          <h2>What&apos;s coming</h2>
          <ul>
            {posts.map((p) => (
              <li key={p.title}>
                <strong>{p.title}</strong>
                <br />
                <span style={{ color: "var(--muted-2)", fontSize: 13 }}>{p.tag} · {p.date}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingPage>
  );
}
