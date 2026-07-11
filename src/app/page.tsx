import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="landing-root">
      <style>{`
        .landing-root{--cream:#FAFAF8;--cream-2:#F0EFEB;--ink:#0F0D14;--muted:#6B6578;--muted-2:#9B94A8;--border:rgba(15,13,20,0.08);--blue:#2563EB;--blue-hover:#1D4ED8}
        .landing-root{font-family:'Geist',system-ui,sans-serif;background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{color:inherit;text-decoration:none}
        .wrap{max-width:1080px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
        .nav{position:sticky;top:0;z-index:100;background:rgba(250,250,248,0.92);backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s}
        .nav.scrolled{border-bottom-color:var(--border)}
        .nav-inner{max-width:1080px;margin:0 auto;padding:20px clamp(20px,4vw,40px);display:flex;align-items:center;justify-content:space-between;gap:20px}
        .logo{font-family:"Instrument Serif",serif;font-size:20px}
        .nav-links{display:flex;gap:28px;font-size:14px;color:var(--muted)}
        .nav-links a:hover{color:var(--ink)}
        .nav-actions{display:flex;gap:20px;align-items:center}
        .nav-actions .link-muted{font-size:14px;color:var(--muted)}
        .nav-actions .link-muted:hover{color:var(--ink)}
        .nav-toggle{display:none;background:none;border:none;color:var(--ink);cursor:pointer;padding:4px;z-index:110}
        @media(max-width:860px){.nav-links{display:none}.nav-actions{display:none}.nav-toggle{display:flex!important}}
        .hero{padding:clamp(48px,10vw,100px) 0;border-bottom:1px solid var(--border);background-image:linear-gradient(to right,rgba(15,13,20,0.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(15,13,20,0.03) 1px,transparent 1px);background-size:32px 32px}
        .hero-inner{max-width:640px;margin:0 auto;text-align:center}
        .hero h1{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(40px,7vw,64px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:24px}
        .hero-desc{margin:28px auto 0;font-size:17px;max-width:460px;color:var(--muted);line-height:1.7}
        .hero-cta{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:40px;flex-wrap:wrap}
        .hero-cta .btn,.cta-actions .btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:500;padding:13px 26px;border-radius:6px;border:none;cursor:pointer;white-space:nowrap;text-decoration:none;line-height:1;transition:background .2s;background:var(--blue);color:#fff}
        .hero-cta .btn:hover,.cta-actions .btn:hover{background:var(--blue-hover)}
        .hero-cta .btn-sm{padding:9px 18px;font-size:13px}
        .text-link{font-size:15px;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:2px}
        .hero-facts{margin-top:56px;padding-top:32px;border-top:1px solid var(--border);font-size:13px;color:var(--muted-2);line-height:1.8}
        .hero-facts .sep{margin:0 12px;opacity:0.4}
        @media(max-width:600px){.hero-facts .sep{display:none}.hero-facts span{display:block}}
        .section{padding:clamp(80px,12vw,140px) 0;border-bottom:1px solid var(--border)}
        .sec-head{max-width:520px;margin-bottom:clamp(48px,8vw,72px)}
        .sec-head.center{text-align:center;margin-left:auto;margin-right:auto}
        .sec-head h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:16px}
        .sec-head p{margin-top:14px;font-size:16px;color:var(--muted);line-height:1.7}
        .feat-list{list-style:none}
        .feat-item{display:grid;grid-template-columns:56px 1fr;gap:clamp(20px,4vw,40px);padding:36px 0;border-top:1px solid var(--border)}
        .feat-item:last-child{border-bottom:1px solid var(--border)}
        .feat-num{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2);padding-top:4px}
        .feat-item h3{font-family:'Geist',sans-serif;font-size:17px;font-weight:500;margin-bottom:8px}
        .feat-item p{font-size:15px;max-width:560px;color:var(--muted);line-height:1.7}
        .why-grid{display:grid;grid-template-columns:repeat(3,1fr)}
        @media(max-width:760px){.why-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.why-grid{grid-template-columns:1fr}}
        .why-item{padding:32px 24px 32px 0;border-top:1px solid var(--border)}
        .why-item h3{font-family:'Geist',sans-serif;font-size:15px;font-weight:500;margin-bottom:8px}
        .why-item p{font-size:14px;color:var(--muted);line-height:1.7}
        .steps{list-style:none;max-width:600px}
        .step{display:grid;grid-template-columns:40px 1fr;gap:24px;padding:32px 0;border-top:1px solid var(--border)}
        .step:last-child{border-bottom:1px solid var(--border)}
        .step-num{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2);padding-top:3px}
        .step h3{font-family:'Geist',sans-serif;font-size:17px;font-weight:500;margin-bottom:6px}
        .step p{font-size:15px;color:var(--muted);line-height:1.7}
        .how-aside{margin-top:64px;padding-top:40px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:24px}
        .how-stat .val{font-family:"Instrument Serif",serif;font-size:clamp(48px,8vw,72px);line-height:1}
        .how-stat .key{font-size:13px;color:var(--muted-2);margin-top:8px}
        .how-metric .num{font-family:'JetBrains Mono',monospace;font-size:20px}
        .how-metric .lbl{font-size:12px;color:var(--muted-2);margin-top:4px}
        .how-metrics{display:flex;gap:clamp(24px,5vw,48px);flex-wrap:wrap}
        .pricing-layout{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,8vw,80px);align-items:start}
        @media(max-width:800px){.pricing-layout{grid-template-columns:1fr}}
        .price-main .amount{font-family:"Instrument Serif",serif;font-size:clamp(56px,10vw,80px);line-height:1;margin-top:16px}
        .price-main .desc{margin-top:16px;font-size:15px;max-width:320px;color:var(--muted);line-height:1.7}
        .price-main .btn{margin-top:36px;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:500;padding:13px 26px;border-radius:6px;border:none;cursor:pointer;background:var(--blue);color:#fff;text-decoration:none}
        .price-includes{list-style:none;margin-top:40px;display:flex;flex-direction:column;gap:12px}
        .price-includes li{font-size:14px;color:var(--muted);padding-left:16px;position:relative}
        .price-includes li::before{content:"—";position:absolute;left:0;color:var(--muted-2)}
        .compare-list{list-style:none}
        .compare-row{display:grid;grid-template-columns:1fr auto;gap:20px;padding:20px 0;border-top:1px solid var(--border);align-items:baseline}
        .compare-row:last-child{border-bottom:1px solid var(--border)}
        .compare-row .name{font-size:15px;font-weight:500}
        .compare-row .desc{font-size:13px;color:var(--muted);margin-top:3px}
        .compare-row .cost{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--muted);white-space:nowrap}
        .compare-row.highlight .name{font-family:"Instrument Serif",serif;font-size:17px}
        .compare-note{font-size:12px;color:var(--muted-2);margin-top:24px;line-height:1.6}
        .quote-block{max-width:640px;margin:0 auto;text-align:center;padding:clamp(80px,12vw,140px) 0;border-bottom:1px solid var(--border)}
        .quote-block blockquote{font-family:"Instrument Serif",serif;font-size:clamp(24px,3.5vw,34px);line-height:1.4}
        .quote-attr{margin-top:32px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;color:var(--muted-2)}
        .cta{padding:clamp(80px,12vw,140px) 0;text-align:center}
        .cta-inner{max-width:520px;margin:0 auto}
        .cta h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:16px}
        .cta p{margin-top:16px;font-size:16px;color:var(--muted);line-height:1.7}
        .cta-actions{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:36px;flex-wrap:wrap}
        footer{padding:48px 0 32px;border-top:1px solid var(--border)}
        .foot-top{display:flex;justify-content:space-between;align-items:flex-start;gap:40px;flex-wrap:wrap;margin-bottom:48px}
        .foot-brand .logo{font-size:20px;margin-bottom:10px}
        .foot-brand p{font-size:14px;max-width:220px;color:var(--muted);line-height:1.7}
        .foot-links{display:flex;gap:clamp(40px,8vw,80px);flex-wrap:wrap}
        .foot-col h4{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:14px}
        .foot-col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
        .foot-col a{font-size:14px;color:var(--muted)}
        .foot-col a:hover{color:var(--ink)}
        .foot-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:24px;border-top:1px solid var(--border);font-size:13px;color:var(--muted-2)}
        .mobile-menu{display:none;position:fixed;inset:0;z-index:200;background:rgba(15,13,20,0.4);opacity:0;pointer-events:none;transition:opacity .35s}
        .mobile-menu.open{display:block!important;opacity:1;pointer-events:auto}
        .mobile-panel{position:absolute;top:0;right:0;width:min(300px,85vw);height:100%;background:var(--cream);border-left:1px solid var(--border);padding:24px;transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1);display:flex;flex-direction:column;gap:4px}
        .mobile-menu.open .mobile-panel{transform:translateX(0)}
        .mobile-panel a{font-size:16px;font-weight:500;padding:14px 0;border-bottom:1px solid var(--border)}
        .mobile-panel .btn{margin-top:20px;width:100%;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:15px;font-weight:500;padding:14px 26px;border-radius:6px;border:none;cursor:pointer;background:var(--blue);color:#fff;text-decoration:none}
        .mobile-close{align-self:flex-end;background:none;border:1px solid var(--border);border-radius:6px;padding:8px;cursor:pointer;color:var(--ink)}
        p,h1,h2,h3,.label{color:var(--ink);line-height:1.7}
        .label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2);display:block;margin-bottom:16px}
        h1{text-wrap:balance}
        ::selection{background:var(--blue);color:#fff}
        .btn-mobile-menu{display:none!important}@media(max-width:860px){.btn-mobile-menu{display:flex!important}}
        @media(max-width:640px){.hero{padding:60px 0 50px}.hero h1{font-size:32px;margin-top:16px}.hero-desc{font-size:15px;margin-top:16px}.hero-cta{flex-direction:column;gap:14px;width:100%}.hero-cta .btn{width:100%;text-align:center}.section{padding:50px 0}.sec-head{margin-bottom:32px}.sec-head h2{font-size:26px}.feat-item{grid-template-columns:1fr;gap:8px;padding:24px 0}.feat-num{display:none}.step{grid-template-columns:1fr;gap:6px;padding:20px 0}.step-num{display:none}.how-aside{flex-direction:column;align-items:flex-start}.pricing-layout{gap:40px}.price-main .btn{width:100%}.cta{padding:50px 0}.cta-actions{flex-direction:column;gap:14px;width:100%}.cta-actions .btn{width:100%}.foot-top{flex-direction:column;gap:24px}}
      `}</style>

      <nav className="nav" id="nav">
        <div className="nav-inner">
          <a href="/" className="logo">Coldpilot</a>
          <div className="nav-links">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#compare">Compare</a>
          </div>
          <div className="nav-actions">
            <Link href="/auth/login" className="link-muted">Log in</Link>
            <Link href="/auth/signup" className="btn btn-sm" style={{background:"var(--blue)",color:"#fff",padding:"9px 18px",fontSize:13,borderRadius:6,textDecoration:"none"}}>Start free</Link>
          </div>
          <button className="nav-toggle" id="navToggle" aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      </nav>

      <div className="mobile-menu" id="mobileMenu">
        <div className="mobile-panel">
          <button className="mobile-close" id="mobileClose" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          <a href="#product" className="mobile-link">Product</a>
          <a href="#how" className="mobile-link">How it works</a>
          <a href="#pricing" className="mobile-link">Pricing</a>
          <a href="#compare" className="mobile-link">Compare</a>
          <Link href="/auth/login" className="mobile-link">Log in</Link>
          <Link href="/auth/signup" className="btn">Start free</Link>
        </div>
      </div>

      <header className="hero">
        <div className="wrap hero-inner">
          <span className="label" style={{marginBottom:0}}>Cold email, without the guesswork</span>
          <h1>Reach more inboxes.<br /><em style={{fontStyle:"italic"}}>Skip the spam folder.</em></h1>
          <p className="hero-desc">Coldpilot warms your inbox, rotates sends, and stops when someone replies — so your outreach lands where it should.</p>
          <div className="hero-cta">
            <Link href="/auth/signup" className="btn">Start for free</Link>
            <a href="#how" className="text-link">See how it works</a>
          </div>
          <div className="hero-facts">
            <span>Free to start</span><span className="sep">·</span>
            <span>Unlimited inboxes</span><span className="sep">·</span>
            <span>Gmail &amp; Outlook</span><span className="sep">·</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </header>

      <section className="section" id="product">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">What's handled</span>
            <h2>Everything the big tools do.<br />Priced for one person.</h2>
            <p>Six things run in the background every time you launch a sequence.</p>
          </div>
          <ul className="feat-list">
            <li className="feat-item"><span className="feat-num">01</span><div><h3>Inbox warm-up</h3><p>New inboxes send a slow, human-looking pattern for two weeks so mailbox providers learn to trust the address before your campaign starts.</p></div></li>
            <li className="feat-item"><span className="feat-num">02</span><div><h3>Multi-inbox rotation</h3><p>Connect as many inboxes as you want. Sends spread across all of them so no single address carries the volume — or the risk.</p></div></li>
            <li className="feat-item"><span className="feat-num">03</span><div><h3>Reply detection</h3><p>The moment a lead replies, books, or bounces, their sequence stops. No awkward follow-up after they've already answered.</p></div></li>
            <li className="feat-item"><span className="feat-num">04</span><div><h3>Personalization tokens</h3><p>Pull first name, company, or any custom field into the subject line and body — no manual find-and-replace.</p></div></li>
            <li className="feat-item"><span className="feat-num">05</span><div><h3>Deliverability monitor</h3><p>A spam-score check runs before every send, so you catch a flagged domain or spammy subject line before your leads do.</p></div></li>
            <li className="feat-item"><span className="feat-num">06</span><div><h3>Plain analytics</h3><p>Opens, replies, and bounces on one screen. Just what you need to know if the sequence is working.</p></div></li>
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">Why founders switch</span>
            <h2>Built for one person running outreach</h2>
          </div>
          <div className="why-grid">
            <div className="why-item"><h3>One flat price</h3><p>Free to start, unlimited volume. No credits, no per-lead charges.</p></div>
            <div className="why-item"><h3>No contracts</h3><p>Month to month. Pause anytime, nothing to negotiate.</p></div>
            <div className="why-item"><h3>Built for one person</h3><p>No seats, no roles, no admin console.</p></div>
            <div className="why-item"><h3>Deliverability first</h3><p>Warm-up and rotation included by default, not an upgrade tier.</p></div>
            <div className="why-item"><h3>Gmail &amp; Outlook</h3><p>Connect your real inbox in minutes. No forwarding tricks.</p></div>
            <div className="why-item"><h3>A person replies</h3><p>Support from someone who built the product, not a ticket queue.</p></div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">How it works</span>
            <h2>From cold list to running sequence, same afternoon</h2>
          </div>
          <ol className="steps">
            <li className="step"><span className="step-num">01</span><div><h3>Connect your inbox</h3><p>Link Gmail or Outlook. Warm-up starts immediately, even before your first sequence.</p></div></li>
            <li className="step"><span className="step-num">02</span><div><h3>Import your leads</h3><p>Upload a CSV or paste a list. Map columns once and you're set.</p></div></li>
            <li className="step"><span className="step-num">03</span><div><h3>Write your sequence</h3><p>First email, follow-ups, delays. Tokens pull from your lead list.</p></div></li>
            <li className="step"><span className="step-num">04</span><div><h3>Launch and track</h3><p>Sends rotate across connected inboxes automatically. Watch replies come in.</p></div></li>
          </ol>
          <div className="how-aside">
            <div className="how-stat"><div className="val">142</div><div className="key">sent today</div></div>
            <div className="how-metrics">
              <div className="how-metric"><div className="num">61</div><div className="lbl">opened</div></div>
              <div className="how-metric"><div className="num">9</div><div className="lbl">replied</div></div>
              <div className="how-metric"><div className="num">96%</div><div className="lbl">inbox placement</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">Pricing</span>
            <h2>One plan. Everything included.</h2>
          </div>
          <div className="pricing-layout">
            <div className="price-main">
              <span className="label">Coldpilot</span>
              <div className="amount" style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:"clamp(56px,10vw,80px)",lineHeight:1,marginTop:16}}>Free</div>
              <p className="desc">Unlimited inboxes, sequences, and leads. No usage tiers to outgrow.</p>
              <ul className="price-includes">
                <li>Unlimited connected inboxes</li>
                <li>Automatic warm-up on every account</li>
                <li>Unlimited leads and sequences</li>
                <li>Reply detection and auto-stop</li>
                <li>Deliverability checks before every send</li>
              </ul>
              <Link href="/auth/signup" className="btn" style={{marginTop:36,display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",fontSize:14,fontWeight:500,padding:"13px 26px",borderRadius:6,border:"none",cursor:"pointer",background:"var(--blue)",color:"#fff",textDecoration:"none"}}>Start sending</Link>
            </div>
            <div id="compare">
              <span className="label">How it compares</span>
              <ul className="compare-list" style={{marginTop:16}}>
                <li className="compare-row highlight"><div><div className="name">Coldpilot</div><div className="desc">One plan, unlimited everything</div></div><div className="cost">Free</div></li>
                <li className="compare-row"><div><div className="name">Instantly</div><div className="desc">Entry plan caps contacts; leads and CRM billed separately</div></div><div className="cost">~$37/mo</div></li>
                <li className="compare-row"><div><div className="name">Smartlead</div><div className="desc">Entry tier limited to 2,000 active leads</div></div><div className="cost">~$39/mo</div></li>
              </ul>
              <p className="compare-note">Competitor pricing is publicly listed entry pricing as of 2026. Most setups need a higher tier or add-ons. Coldpilot is free to start.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="quote-block">
          <blockquote>I built Coldpilot because every tool wanted <em style={{fontStyle:"italic"}}>$47 to start</em> and another charge for leads before I'd sent a single email.</blockquote>
          <p className="quote-attr">— Builder's note, Too Design</p>
        </div>
      </div>

      <section className="cta">
        <div className="wrap cta-inner">
          <span className="label" style={{marginBottom:0}}>Ready when you are</span>
          <h2>Connect an inbox.<br />Send your first sequence today.</h2>
          <p>Free to start, cancel anytime. No credit card needed.</p>
          <div className="cta-actions">
            <Link href="/auth/signup" className="btn">Start for free</Link>
            <a href="#how" className="text-link">See how it works</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand"><div className="logo">Coldpilot</div><p>Cold email for solo founders. One flat price, nothing bolted on.</p></div>
            <div className="foot-links">
              <div className="foot-col"><h4>Product</h4><ul><li><a href="#product">Features</a></li><li><a href="#how">How it works</a></li><li><a href="#pricing">Pricing</a></li></ul></div>
              <div className="foot-col"><h4>Company</h4><ul><li><a href="#">About</a></li><li><a href="#">Contact</a></li><li><a href="#">Changelog</a></li></ul></div>
              <div className="foot-col"><h4>Legal</h4><ul><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li></ul></div>
            </div>
          </div>
          <div className="foot-bottom"><span>&copy; 2026 Coldpilot. Built by Too Design.</span><span>Made for the inbox, not the spam folder.</span></div>
        </div>
      </footer>

      <Script id="landing-js">{`
        (function(){
          var n=document.getElementById("nav");
          if(n)window.addEventListener("scroll",function(){n.classList.toggle("scrolled",scrollY>40)},{passive:true});
          var m=document.getElementById("mobileMenu"),t=document.getElementById("navToggle"),c=document.getElementById("mobileClose");
          if(!m||!t||!c)return;
          function open(){m.className="mobile-menu open";t.style.display="none";document.body.style.overflow="hidden"}
          function shut(){m.className="mobile-menu";t.style.display="";document.body.style.overflow=""}
          t.addEventListener("click",open);
          c.addEventListener("click",shut);
          m.addEventListener("click",function(e){if(e.target===m)shut()});
          var as=m.querySelectorAll("a");for(var i=0;i<as.length;i++)as[i].addEventListener("click",shut);
          document.addEventListener("keydown",function(e){if(e.key==="Escape")shut()});
          if(!matchMedia("(prefers-reduced-motion:reduce)").matches){
            var ro=new IntersectionObserver(function(e){e.forEach(function(ee){if(ee.isIntersecting){ee.target.classList.add("in");ro.unobserve(ee.target)}})},{threshold:0.08,rootMargin:"0px 0px -40px 0px"});
            document.querySelectorAll(".reveal").forEach(function(el){ro.observe(el)});
          }
        })();
      `}</Script>
    </div>
  );
}
