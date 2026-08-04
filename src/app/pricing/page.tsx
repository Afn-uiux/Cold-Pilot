import Link from "next/link";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Try the full engine before you pay.",
    leads: "300 active leads",
    inboxes: "2 connected inboxes",
    verification: "300 verifications / mo",
    cta: "Start free",
    highlight: false,
    features: [
      "2 connected inboxes",
      "300 active leads",
      "300 verifications / month",
      "Warm-up on your account",
      "Multi-step sequences",
      "Reply detection & auto-stop",
    ],
  },
  {
    name: "Starter",
    price: "$19",
    period: "/ month",
    tagline: "Unlimited inboxes. The real upgrade over the free tier.",
    leads: "5,000 active leads",
    inboxes: "Unlimited inboxes",
    verification: "1,000 verifications / mo",
    cta: "Start with Starter",
    highlight: false,
    features: [
      "Unlimited connected inboxes",
      "5,000 active leads",
      "1,000 verifications / month",
      "AI email generation",
      "Multi-inbox rotation",
      "Deliverability checks on every send",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/ month",
    tagline: "For teams sending real volume. Half the price of the equivalent.",
    leads: "30,000 active leads",
    inboxes: "Unlimited inboxes",
    verification: "5,000 verifications / mo",
    cta: "Go Pro",
    highlight: true,
    features: [
      "Everything in Starter",
      "30,000 active leads",
      "5,000 verifications / month",
      "AI personalization at scale",
      "Smart scheduling & pacing",
      "Priority support",
    ],
  },
  {
    name: "Agency",
    price: "$99",
    period: "/ month",
    tagline: "White-label, API access, and room for every client you'll take on.",
    leads: "150,000 active leads",
    inboxes: "Unlimited inboxes",
    verification: "20,000 verifications / mo",
    cta: "Go Agency",
    highlight: false,
    features: [
      "Everything in Pro",
      "150,000 active leads",
      "20,000 verifications / month",
      "White-label branding",
      "API & webhooks",
      "Workspace seats & roles",
    ],
  },
];

const creditPacks = [
  { credits: "100 credits", price: "$5", per: "$0.050 / credit" },
  { credits: "500 credits", price: "$15", per: "$0.030 / credit" },
  { credits: "2,000 credits", price: "$40", per: "$0.020 / credit" },
  { credits: "10,000 credits", price: "$100", per: "$0.010 / credit" },
];

export default function PricingPage() {
  return (
    <div className="pricing-root">
      <style>{`
        .pricing-root{--cream:#FAFAF8;--cream-2:#F0EFEB;--ink:#0F0D14;--muted:#6B6578;--muted-2:#9B94A8;--border:rgba(15,13,20,0.08);--blue:#2563EB;--blue-hover:#1D4ED8}
        .pricing-root{font-family:'Geist',system-ui,sans-serif;background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh}
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
        .hero-note{margin-top:32px;font-size:13px;color:var(--muted-2);line-height:1.8}
        .tiers{padding:clamp(48px,8vw,72px) 0 0;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:stretch}
        @media(max-width:960px){.tiers{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.tiers{grid-template-columns:1fr}}
        .tier{border:1px solid var(--border);border-radius:14px;padding:28px 24px;display:flex;flex-direction:column;gap:18px;background:#fff}
        .tier.highlight{border-color:var(--blue);box-shadow:0 8px 30px rgba(37,99,235,0.10);position:relative}
        .tier-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--blue);color:#fff;font-size:11px;font-weight:500;letter-spacing:.06em;padding:5px 14px;border-radius:999px}
        .tier .name{font-family:"Instrument Serif",serif;font-size:20px}
        .tier .tagline{font-size:13px;color:var(--muted);line-height:1.6;min-height:42px}
        .tier .amount{font-family:"Instrument Serif",serif;font-size:44px;line-height:1}
        .tier .period{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2)}
        .tier .limits{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink)}
        .tier .limits b{font-weight:500}
        .tier ul{list-style:none;display:flex;flex-direction:column;gap:9px;border-top:1px solid var(--border);padding-top:16px}
        .tier li{font-size:13px;color:var(--muted);padding-left:20px;position:relative;line-height:1.5}
        .tier li::before{content:"";position:absolute;left:0;top:7px;width:5px;height:5px;border-radius:50%;background:var(--blue)}
        .tier .btn{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:500;padding:13px 18px;border-radius:8px;border:none;cursor:pointer;background:var(--cream-2);color:var(--ink);transition:background .2s}
        .tier .btn:hover{background:var(--border)}
        .tier.highlight .btn{background:var(--blue);color:#fff}
        .tier.highlight .btn:hover{background:var(--blue-hover)}
        .section{padding:clamp(80px,10vw,120px) 0;border-bottom:1px solid var(--border)}
        .sec-head{max-width:520px;margin-bottom:clamp(40px,6vw,56px)}
        .sec-head.center{text-align:center;margin-left:auto;margin-right:auto}
        .sec-head h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:16px}
        .sec-head p{margin-top:14px;font-size:16px;color:var(--muted);line-height:1.7}
        .compare-wrap{overflow-x:auto}
        table{width:100%;border-collapse:collapse;min-width:640px}
        th{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);text-align:left;padding:14px 16px;border-bottom:1px solid var(--border)}
        td{padding:18px 16px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:top}
        tr:last-child td{border-bottom:none}
        td.feature{font-weight:500;color:var(--ink)}
        td .plan-name{font-weight:500}
        td .plan-price{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--muted)}
        td .plan-note{font-size:12px;color:var(--muted-2);margin-top:3px;line-height:1.5}
        .coldpilot-col{background:rgba(37,99,235,0.04)}
        .coldpilot-col .plan-name{color:var(--blue)}
        .compare-note{font-size:12px;color:var(--muted-2);margin-top:20px;line-height:1.6}
        .faq{max-width:640px;margin:0 auto}
        .faq-item{padding:24px 0;border-top:1px solid var(--border)}
        .faq-item:last-child{border-bottom:1px solid var(--border)}
        .faq-item h3{font-size:16px;font-weight:500;margin-bottom:8px}
        .faq-item p{font-size:14px;color:var(--muted);line-height:1.7}
        .packs{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        @media(max-width:960px){.packs{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.packs{grid-template-columns:1fr}}
        .pack{border:1px solid var(--border);border-radius:14px;padding:24px;background:#fff;display:flex;flex-direction:column;gap:8px}
        .pack .pack-credits{font-family:"Instrument Serif",serif;font-size:22px}
        .pack .pack-price{font-family:"Instrument Serif",serif;font-size:30px}
        .pack .pack-per{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2)}
        .credit-costs{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px}
        .credit-cost{border:1px solid var(--border);border-radius:10px;padding:14px 18px;font-size:13px;color:var(--muted);background:#fff}
        .credit-cost b{color:var(--ink);font-weight:500}
        .cta{padding:clamp(80px,10vw,120px) 0;text-align:center}
        .cta-inner{max-width:520px;margin:0 auto}
        .cta h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:16px}
        .cta p{margin-top:16px;font-size:16px;color:var(--muted);line-height:1.7}
        .cta-actions{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:36px;flex-wrap:wrap}
        .cta .btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:500;padding:13px 26px;border-radius:6px;border:none;cursor:pointer;background:var(--blue);color:#fff;transition:background .2s}
        .cta .btn:hover{background:var(--blue-hover)}
        .text-link{font-size:15px;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:2px}
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

      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="logo">Coldpilot</a>
          <div className="nav-links">
            <a href="/#product">Product</a>
            <a href="/#how">How it works</a>
            <a href="/pricing" className="active">Pricing</a>
            <a href="/#how">How it works</a>
          </div>
          <div className="nav-actions">
            <Link href="/auth/login" className="link-muted">Log in</Link>
            <Link href="/auth/signup" className="link-muted" style={{fontWeight:500,color:"var(--blue)"}}>Start free</Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <span className="label" style={{marginBottom:0}}>Pricing</span>
          <h1>Pro features.<br />Half the price.</h1>
          <p className="hero-desc">Unlimited inboxes on every paid plan. AI and email verification included — not sold as add-ons. No seat fees, no contracts.</p>
          <p className="hero-note">Billed monthly. Cancel anytime. Free tier works forever, no credit card required.</p>
        </div>
      </header>

      <section className="tiers wrap">
        {tiers.map((tier) => (
          <div key={tier.name} className={"tier" + (tier.highlight ? " highlight" : "")}>
            {tier.highlight && <span className="tier-badge">Most popular</span>}
            <div>
              <div className="name">{tier.name}</div>
              <div className="tagline">{tier.tagline}</div>
            </div>
            <div>
              <span className="amount">{tier.price}</span>
              <span className="period"> {tier.period}</span>
            </div>
            <div className="limits">
              <span><b>{tier.leads}</b></span>
              <span><b>{tier.inboxes}</b></span>
              <span><b>{tier.verification}</b></span>
            </div>
            <ul>
              {tier.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link href="/auth/signup" className="btn">{tier.cta}</Link>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">No hidden costs</span>
            <h2>Everything is included in every paid plan.</h2>
            <p>AI email generation and email verification are included in every paid plan — not sold as add-ons. No seat fees, no per-inbox charges.</p>
          </div>
        </div>
      </section>

      <section className="section" id="credits">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">Credits</span>
            <h2>Verification and AI run on one credit balance</h2>
            <p>Every paid plan includes a monthly credit allowance. Run out? Top up in seconds — credits never expire, and they're drawn from the same balance as your included allowance.</p>
          </div>
          <div className="credit-costs">
            <div className="credit-cost"><b>Email verification</b> — 0.25 credits / check</div>
            <div className="credit-cost"><b>AI email writing</b> — 2 credits / generation</div>
            <div className="credit-cost"><b>Sending, warm-up, inbox</b> — 0 credits, always free</div>
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

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">FAQ</span>
            <h2>Good questions</h2>
          </div>
          <div className="faq">
            <div className="faq-item">
              <h3>What does "unlimited inboxes" mean?</h3>
              <p>Connect as many Gmail, Outlook, or SMTP accounts as you want on every paid plan. Sends rotate across all of them automatically.</p>
            </div>
            <div className="faq-item">
              <h3>What happens when I hit my verification limit?</h3>
              <p>Campaigns keep running — only new verification pauses until your next monthly credit cycle or you buy a credit pack. Verification costs 0.25 credits per check and credits never expire.</p>
            </div>
            <div className="faq-item">
              <h3>What is a credit worth?</h3>
              <p>One credit is one unit of usage. Verifying an email costs 0.25 credits, an AI email generation costs 2 credits. Credits packs start at 100 credits for $5, and your monthly allowance tops the same balance up every cycle.</p>
            </div>
            <div className="faq-item">
              <h3>Is there a free trial?</h3>
              <p>The Free plan is a permanent trial: 2 inboxes, 300 leads, and 300 verifications a month forever. Upgrade only when you need more.</p>
            </div>
            <div className="faq-item">
              <h3>Can I switch plans or cancel?</h3>
              <p>Yes, any time, month to month. Downgrade or cancel in one click — no contracts, no retention flow.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta-inner">
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
            <div className="foot-brand"><div className="logo">Coldpilot</div><p>Cold email for solo founders. Pro features at half the price.</p></div>
            <div className="foot-links">
              <div className="foot-col"><h4>Product</h4><ul><li><a href="/#product">Features</a></li><li><a href="/#how">How it works</a></li><li><Link href="/pricing">Pricing</Link></li></ul></div>
              <div className="foot-col"><h4>Company</h4><ul><li><Link href="/about">About</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
              <div className="foot-col"><h4>Legal</h4><ul><li><Link href="/legal/privacy">Privacy</Link></li><li><Link href="/legal/terms">Terms</Link></li></ul></div>
            </div>
          </div>
          <div className="foot-bottom"><span>&copy; 2026 Coldpilot.</span><span>Made for the inbox, not the spam folder.</span></div>
        </div>
      </footer>
    </div>
  );
}
