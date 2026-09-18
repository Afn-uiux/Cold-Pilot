"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import Logo from "@/components/logo";
import { CREDIT_PACKS } from "@/lib/plans";
import { formatPrice } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-client";

const tiers = [
  {
    name: "Free",
    monthly: 0,
    period: "14 days",
    tagline: "Try the full engine free for 14 days, no credit card.",
    leads: "300 active leads",
    inboxes: "2 connected inboxes",
    verification: "1,000 free credits",
    cta: "Start free",
    highlight: false,
    features: [
      "14-day free trial, no credit card",
      "2 connected inboxes",
      "300 active leads",
      "1,000 free credits on signup",
      "Warm-up on your account",
      "Multi-step sequences",
      "Reply detection & auto-stop",
    ],
  },
  {
    name: "Starter",
    monthly: 28500,
    period: "/month",
    tagline: "Unlimited inboxes. The real upgrade over the free tier.",
    leads: "5,000 active leads",
    inboxes: "Unlimited inboxes",
    verification: "1,000 free credits",
    cta: "Start with Starter",
    highlight: false,
    features: [
      "Unlimited connected inboxes",
      "5,000 active leads",
      "AI email writing",
      "Multi-inbox rotation",
      "Deliverability checks on every send",
    ],
  },
  {
    name: "Pro",
    monthly: 73500,
    period: "/month",
    tagline: "For teams sending real volume. Half the price of the equivalent.",
    leads: "30,000 active leads",
    inboxes: "Unlimited inboxes",
    verification: "1,000 free credits",
    cta: "Go Pro",
    highlight: true,
    features: [
      "Everything in Starter",
      "30,000 active leads",
      "AI personalization at scale",
      "Smart scheduling & pacing",
      "Priority support",
    ],
  },
  {
    name: "Agency",
    monthly: 148500,
    period: "/month",
    tagline: "White-label, API access, and room for every client you'll take on.",
    leads: "150,000 active leads",
    inboxes: "Unlimited inboxes",
    verification: "1,000 free credits",
    cta: "Go Agency",
    highlight: false,
    features: [
      "Everything in Pro",
      "150,000 active leads",
      "White-label branding",
      "API & webhooks",
      "Workspace seats & roles",
    ],
  },
];

const faqs = [
  {
    q: 'What does "unlimited inboxes" mean?',
    a: "Connect as many Gmail, Outlook, or SMTP accounts as you want on every paid plan. Sends rotate across all of them automatically.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "Campaigns pause and verification/AI stop until you buy a credit pack or upgrade. Sending costs 0.02 credits per email, import 0.05 credits per lead, verification 0.25 credits per check, and AI writing 2 credits per generation. Your data is never locked out — everything stays viewable.",
  },
  {
    q: "What is a credit worth?",
    a: "One credit is one unit of usage. Sending an email costs 0.02 credits, importing a lead costs 0.05 credits, verifying an email costs 0.25 credits, and an AI email generation costs 2 credits. Every account gets 1,000 credits free on signup. No subscription? No problem — buy credit packs and pay as you go. Need more? Packs start at 100 credits for {pack_start}.",
  },
  {
    q: "Is there a free trial?",
    a: "Every new account gets 14 days free with no credit card: 2 inboxes and 1,000 one-time credits. After day 14 you can still log in and see everything — you just can't send, import, verify, or use AI until you add credits or upgrade. Upgrade anytime, and it costs less than the tools you're replacing.",
  },
  {
    q: "Can I switch plans or cancel?",
    a: "Yes, any time. Downgrade or cancel in one click — no contracts, no retention flow. Yearly billing saves you two months.",
  },
];

const Check = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" className="check">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function PricingPage() {
  const [view, setView] = useState<"plans" | "credits">("plans");
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const currency = useCurrency();
  const creditPacks = CREDIT_PACKS.map((pack) => ({
    credits: `${pack.credits.toLocaleString()} credits`,
    price: formatPrice(pack.price, currency),
    per: `${formatPrice(pack.price / pack.credits, currency)} / credit`,
  }));

  return (
    <div className="pricing-root">
      <style>{`
        .pricing-root{--cream:#FAFAF8;--cream-2:#F0EFEB;--ink:#0F0D14;--muted:#6B6578;--muted-2:#9B94A8;--border:rgba(15,13,20,0.08);--blue:#2563EB;--blue-hover:#1D4ED8}
        .pricing-root{font-family:'Geist',system-ui,sans-serif;background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased;overflow:clip;min-height:100vh}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{color:inherit;text-decoration:none}
        p,h1,h2,h3{color:var(--ink);line-height:1.7}
        .wrap{max-width:1080px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
        .label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2);display:block;margin-bottom:16px}
        .nav{position:sticky;top:0;z-index:100;background:rgba(250,250,248,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
        .nav-inner{max-width:1080px;margin:0 auto;padding:20px clamp(20px,4vw,40px);display:flex;align-items:center;justify-content:space-between;gap:20px}
        .logo{font-family:"Instrument Serif",serif;font-size:20px}
        .nav-links{display:flex;gap:28px;font-size:14px;color:var(--muted)}
        .nav-links a:hover{color:var(--ink)}
        .nav-links a.active{color:var(--ink)}
        .nav-actions{display:flex;gap:20px;align-items:center}
        .nav-actions .link-muted{font-size:14px;color:var(--muted)}
        .nav-actions .link-muted:hover{color:var(--ink)}
        .hero{padding:clamp(48px,8vw,88px) 0 0;text-align:center}
        .hero h1{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(40px,6vw,60px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:20px}
        .hero-desc{margin:24px auto 0;font-size:17px;max-width:560px;color:var(--muted);line-height:1.7}
        .hero-note{margin-top:24px;font-size:13px;color:var(--muted-2);line-height:1.8}

        .pricing-toggle{display:flex;justify-content:center;gap:4px;margin:44px auto 0;max-width:420px;background:var(--cream-2);border:1px solid var(--border);border-radius:12px;padding:4px}
        .pricing-toggle button{flex:1;padding:11px 0;border:none;background:transparent;border-radius:9px;font-family:inherit;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;transition:.2s}
        .pricing-toggle button:hover{color:var(--ink)}
        .pricing-toggle button.active{background:#fff;color:var(--ink);box-shadow:0 2px 10px rgba(15,13,20,0.09)}
        .billing-toggle{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:24px;font-size:13px;color:var(--muted)}
        .switch{position:relative;display:inline-block;width:44px;height:24px;vertical-align:middle}
        .switch input{opacity:0;width:0;height:0}
        .slider{position:absolute;cursor:pointer;inset:0;background:#d3d1d9;transition:.3s;border-radius:24px}
        .slider:before{position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;background:#fff;transition:.3s;border-radius:50%}
        input:checked + .slider{background:var(--blue)}
        input:checked + .slider:before{transform:translateX(20px)}
        .saving{color:var(--blue);font-weight:500}
        .billing-label{font-weight:500}
        .billing-label.active{color:var(--ink);font-weight:600}

        .tiers{padding:clamp(40px,6vw,56px) 0 0;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:stretch}
        @media(max-width:960px){.tiers{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.tiers{grid-template-columns:1fr}}
        .tier{border:1px solid var(--border);border-radius:14px;padding:28px 24px;display:flex;flex-direction:column;gap:18px;background:#fff;transition:transform .25s,box-shadow .25s}
        .tier:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(15,13,20,0.08)}
        .tier.highlight{background:var(--blue);border-color:var(--blue);color:#fff;box-shadow:0 12px 36px rgba(37,99,235,0.22)}
        .tier.highlight:hover{transform:translateY(-4px);box-shadow:0 18px 44px rgba(37,99,235,0.30)}
        .tier .name{font-family:"Instrument Serif",serif;font-size:20px}
        .tier.highlight .name{color:#fff}
        .tier .tagline{font-size:13px;color:var(--muted);line-height:1.6;min-height:42px}
        .tier.highlight .tagline{color:rgba(255,255,255,0.85)}
        .tier .amount{font-family:"Instrument Serif",serif;font-size:44px;line-height:1}
        .tier.highlight .amount{color:#fff}
        .tier .period{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2)}
        .tier.highlight .period{color:rgba(255,255,255,0.8)}
        .tier .limits{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink)}
        .tier.highlight .limits{color:#fff}
        .tier .limits b{font-weight:500}
        .tier ul{list-style:none;display:flex;flex-direction:column;gap:9px;border-top:1px solid var(--border);padding-top:16px}
        .tier.highlight ul{border-color:rgba(255,255,255,0.25)}
        .tier li{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--muted);line-height:1.5}
        .tier.highlight li{color:rgba(255,255,255,0.9)}
        .tier .check{width:14px;height:14px;flex-shrink:0;margin-top:3px;color:var(--blue)}
        .tier.highlight .check{color:#fff}
        .tier .btn{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:500;padding:13px 18px;border-radius:8px;border:none;cursor:pointer;background:var(--cream-2);color:var(--ink);transition:background .2s}
        .tier .btn:hover{background:var(--border)}
        .tier.highlight .btn{background:#fff;color:var(--blue)}
        .tier.highlight .btn:hover{background:#eef2ff}

        .section{padding:clamp(80px,10vw,120px) 0;border-bottom:1px solid var(--border)}
        .sec-head{max-width:520px;margin-bottom:clamp(40px,6vw,56px)}
        .sec-head.center{text-align:center;margin-left:auto;margin-right:auto}
        .sec-head h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:16px}
        .sec-head p{margin-top:14px;font-size:16px;color:var(--muted);line-height:1.7}
        .packs{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        @media(max-width:960px){.packs{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.packs{grid-template-columns:1fr}}
        .pack{border:1px solid var(--border);border-radius:14px;padding:24px;background:#fff;display:flex;flex-direction:column;gap:8px;transition:transform .25s,box-shadow .25s}
        .pack:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(15,13,20,0.08)}
        .pack .pack-credits{font-family:"Instrument Serif",serif;font-size:22px}
        .pack .pack-price{font-family:"Instrument Serif",serif;font-size:30px}
        .pack .pack-per{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2)}
        .credit-costs{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px}
        .credit-cost{border:1px solid var(--border);border-radius:10px;padding:14px 18px;font-size:13px;color:var(--muted);background:#fff}
        .credit-cost b{color:var(--ink);font-weight:500}

        .faq{max-width:640px;margin:0 auto}
        .faq-item{border-top:1px solid var(--border)}
        .faq-item:last-child{border-bottom:1px solid var(--border)}
        .faq-question{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px 0;background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;font-size:16px;font-weight:500;color:var(--ink);transition:color .2s}
        .faq-question:hover{color:var(--blue)}
        .faq-chevron{width:16px;height:16px;flex-shrink:0;color:var(--muted-2);transition:transform .25s}
        .faq-item.open .faq-chevron{transform:rotate(180deg);color:var(--blue)}
        .faq-answer{max-height:0;overflow:hidden;transition:max-height .3s ease}
        .faq-answer p{padding-bottom:22px;font-size:14px;color:var(--muted);line-height:1.7}

        .cta{margin:0 clamp(20px,4vw,40px) clamp(80px,10vw,120px)}
        .cta-inner{border-radius:24px;background:linear-gradient(135deg,var(--blue),#3B82F6);padding:clamp(56px,8vw,80px) 24px;text-align:center}
        .cta h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;color:#fff}
        .cta p{margin-top:16px;font-size:16px;color:rgba(255,255,255,0.9);line-height:1.7}
        .cta .label{color:rgba(255,255,255,0.7)}
        .cta-actions{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:36px;flex-wrap:wrap}
        .cta .btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;border:none;cursor:pointer;background:#fff;color:var(--blue);transition:background .2s}
        .cta .btn:hover{background:#eef2ff}
        .text-link{font-size:15px;color:rgba(255,255,255,0.85);border-bottom:1px solid rgba(255,255,255,0.4);padding-bottom:2px}
        .text-link:hover{color:#fff}
        footer{padding:48px 0 32px}
        .foot-top{display:flex;justify-content:space-between;align-items:flex-start;gap:40px;flex-wrap:wrap;margin-bottom:48px}
        .foot-brand .logo{font-size:20px;margin-bottom:10px}
        .foot-brand p{font-size:14px;max-width:220px;color:var(--muted);line-height:1.7}
        .foot-links{display:flex;gap:clamp(40px,8vw,80px);flex-wrap:wrap}
        .foot-col h4{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:14px}
        .foot-col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
        .foot-col a{font-size:14px;color:var(--muted)}
        .foot-col a:hover{color:var(--ink)}
        .foot-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:24px;border-top:1px solid var(--border);font-size:13px;color:var(--muted-2)}
        ::selection{background:var(--blue);color:#fff}
        @media(max-width:640px){.hero h1{font-size:32px}.nav-links{display:none}.tier .tagline{min-height:0}}
      `}</style>

      <SiteHeader />

      <header className="hero">
        <div className="wrap">
          <span className="label" style={{marginBottom:0}}>Pricing</span>
          <h1>Pro features.<br />Half the price.</h1>
          <p className="hero-desc">Unlimited inboxes on every paid plan. AI email writing included — not sold as an add-on. No seat fees, no contracts.</p>
        </div>

        <div className="pricing-toggle">
          <button type="button" className={view === "plans" ? "active" : ""} onClick={() => setView("plans")}>Plans</button>
          <button type="button" className={view === "credits" ? "active" : ""} onClick={() => setView("credits")}>Credits</button>
        </div>

        {view === "plans" && (
          <div className="billing-toggle">
            <span className={"billing-label" + (!yearly ? " active" : "")}>Monthly</span>
            <label className="switch">
              <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
              <span className="slider"></span>
            </label>
            <span className={"billing-label" + (yearly ? " active" : "")}>Yearly</span>
            <span className="saving">save 2 months</span>
          </div>
        )}
      </header>

      {view === "plans" && (
        <section className="tiers wrap">
          {tiers.map((tier) => {
            const price = formatPrice(yearly ? tier.monthly * 10 : tier.monthly, currency);
            const period = tier.monthly === 0 ? tier.period : yearly ? "/year" : tier.period;
            return (
              <div key={tier.name} className={"tier" + (tier.highlight ? " highlight" : "")}>
                <div>
                  <div className="name">{tier.name}</div>
                  <div className="tagline">{tier.tagline}</div>
                </div>
                <div>
                  <span className="amount">{price}</span>
                  <span className="period"> {period}</span>
                </div>
                <div className="limits">
                  <span><b>{tier.leads}</b></span>
                  <span><b>{tier.inboxes}</b></span>
                  <span><b>{tier.verification}</b></span>
                </div>
                <ul>
                  {tier.features.map((f) => <li key={f}><Check />{f}</li>)}
                </ul>
                <Link href="/auth/signup" className="btn">{tier.cta}</Link>
              </div>
            );
          })}
        </section>
      )}

      {view === "credits" && (
        <section className="section" id="credits">
          <div className="wrap">
            <div className="sec-head center" style={{marginBottom:32}}>
              <span className="label">Credits</span>
              <h2 style={{marginTop:8}}>One balance. Every feature.</h2>
              <p>Not ready to subscribe? Credits also cover lead imports and sending — no monthly commitment. Warmup requires a plan.</p>
            </div>
            <div style={{display:"flex",gap:24,justifyContent:"center",flexWrap:"wrap",marginBottom:40}}>
              <div style={{flex:"1 1 280px",maxWidth:380,border:"1px solid var(--border)",borderRadius:12,padding:"24px 28px"}}>
                <p style={{fontWeight:600,fontSize:15,marginBottom:12}}>With a plan</p>
                <p style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>Sending is unlimited. Credits cover:</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div className="credit-cost"><b>Email verification</b> — 0.25 credits / check</div>
                  <div className="credit-cost"><b>AI email writing</b> — 2 credits / generation</div>
                </div>
              </div>
              <div style={{flex:"1 1 280px",maxWidth:380,border:"1px solid var(--border)",borderRadius:12,padding:"24px 28px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                  <p style={{fontWeight:600,fontSize:15,margin:0}}>Without a plan</p>
                  <span style={{fontSize:11,background:"var(--border)",padding:"2px 8px",borderRadius:6}}>Pay as you go</span>
                </div>
                <p style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>No subscription needed. Credits cover everything:</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div className="credit-cost"><b>Lead import</b> — 0.05 credits / lead</div>
                  <div className="credit-cost"><b>Sending</b> — 0.02 credits / email</div>
                  <div className="credit-cost"><b>Email verification</b> — 0.25 credits / check</div>
                  <div className="credit-cost"><b>AI email writing</b> — 2 credits / generation</div>
                </div>
              </div>
            </div>
            <div className="packs" style={{ marginTop: 32 }}>
              {creditPacks.map((pack) => (
                <div key={pack.credits} className="pack">
                  <div className="pack-credits">{pack.credits}</div>
                  <div className="pack-price">{pack.price}</div>
                  <div className="pack-per">{pack.per}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">No hidden costs</span>
            <h2>Everything is included in every paid plan.</h2>
            <p>AI email writing is included in every paid plan — not sold as an add-on. No seat fees, no per-inbox charges. Verification runs on credits, and every account starts with 1,000 free.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">FAQ</span>
            <h2>Good questions</h2>
          </div>
          <div className="faq">
            {faqs.map((item, i) => (
              <div key={item.q} className={"faq-item" + (openFaq === i ? " open" : "")}>
                <button type="button" className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                  <svg className="faq-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="faq-answer" style={{ maxHeight: openFaq === i ? 240 : 0 }}>
                  <p>{item.a.replace("{pack_start}", formatPrice(CREDIT_PACKS[0].price, currency))}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta-inner">
          <span className="label" style={{marginBottom:0}}>Ready when you are</span>
          <h2>Connect an inbox.<br />Send your first sequence today.</h2>
          <p>Free to start, cancel anytime. No credit card needed.</p>
          <div className="cta-actions">
            <Link href="/auth/signup" className="btn">Start free</Link>
            <a href="/#how" className="text-link">See how it works</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand"><div className="logo"><Logo height={22} /></div><p>Cold email for solo founders. Pro features at half the price.</p></div>
            <div className="foot-links">
              <div className="foot-col"><h4>Product</h4><ul><li><a href="/#product">Features</a></li><li><a href="/#how">How it works</a></li><li><Link href="/pricing">Pricing</Link></li></ul></div>
              <div className="foot-col"><h4>Company</h4><ul><li><Link href="/about">About</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
              <div className="foot-col"><h4>Legal</h4><ul><li><Link href="/legal/privacy">Privacy</Link></li><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/acceptable-use">Acceptable Use</Link></li></ul></div>
            </div>
          </div>
          <div className="foot-bottom"><span>&copy; 2026 ColdPilot.</span><span>Made for the inbox, not the spam folder.</span></div>
        </div>
      </footer>
    </div>
  );
}
