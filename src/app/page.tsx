import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SiteHeader from "@/components/site-header";

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
        .logo{font-family:"Instrument Serif",serif;font-size:20px}
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
        .feat-rows{display:flex;flex-direction:column}
        .feat-row{display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,5vw,64px);align-items:center;padding:56px 0;border-top:1px solid var(--border)}
        .feat-row:first-child{border-top:none;padding-top:8px}
        .feat-row[data-side="left"] .feat-illust{order:-1}
        .feat-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;color:var(--muted);margin-bottom:16px}
        .feat-eyebrow svg{width:15px;height:15px;flex-shrink:0}
        .feat-text h3{font-family:'Geist',sans-serif;font-size:clamp(22px,2.6vw,28px);font-weight:600;letter-spacing:-0.02em;line-height:1.2;margin-bottom:14px}
        .feat-text p{font-size:15px;color:var(--muted);line-height:1.7;max-width:420px;margin-bottom:18px}
        .feat-link{display:inline-flex;align-items:center;gap:4px;font-size:14px;font-weight:500;color:var(--blue)}
        .feat-link svg{width:13px;height:13px;transition:transform .2s ease}
        .feat-link:hover svg{transform:translateX(3px)}
        .feat-illust{background:#F5F4F1;border-radius:16px;height:280px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .feat-illust svg{width:88%;height:88%}
        .feat-glow{animation:featFloat 4s ease-in-out infinite}
        .feat-pulse{animation:featPulse 2.6s ease-in-out infinite}
        .feat-flow{stroke-dasharray:6 6;animation:featFlow 1.4s linear infinite}
        @keyframes featFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes featPulse{0%,100%{opacity:.55;r:15}50%{opacity:0;r:30}}
        @keyframes featFlow{to{stroke-dashoffset:-24}}
        @media(prefers-reduced-motion:reduce){.feat-glow,.feat-pulse,.feat-flow{animation:none}}
        @media(max-width:820px){.feat-row{grid-template-columns:1fr;gap:24px;padding:40px 0}.feat-row[data-side="left"] .feat-illust{order:0}.feat-illust{height:220px}}
        .reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.2,.7,.3,1), transform .7s cubic-bezier(.2,.7,.3,1)}
        .reveal.in{opacity:1;transform:translateY(0)}
        @media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
        .why-grid{display:grid;grid-template-columns:repeat(3,1fr)}
        @media(max-width:760px){.why-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.why-grid{grid-template-columns:1fr}}
        .why-item{padding:32px 24px 32px 0;border-top:1px solid var(--border)}
        .why-item h3{font-family:'Geist',sans-serif;font-size:15px;font-weight:500;margin-bottom:8px}
        .why-item p{font-size:14px;color:var(--muted);line-height:1.7}
        .steps{list-style:none;max-width:600px}
        .step{display:grid;grid-template-columns:48px 1fr;gap:24px;padding:32px 0;border-top:1px solid var(--border)}
        .step:last-child{border-bottom:1px solid var(--border)}
        .step-num{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted-2);padding-top:3px}
        .step-illust{width:48px;height:48px;border-radius:10px;background:var(--cream-2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .step-illust svg{width:24px;height:24px;stroke:var(--muted);stroke-width:1.2;fill:none;stroke-linecap:round;stroke-linejoin:round}
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
        p,h1,h2,h3,.label{color:var(--ink);line-height:1.7}
        .label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2);display:block;margin-bottom:16px}
        h1{text-wrap:balance}
        ::selection{background:var(--blue);color:#fff}
        @media(max-width:640px){.hero{padding:60px 0 50px}.hero h1{font-size:32px;margin-top:16px}.hero-desc{font-size:15px;margin-top:16px}.hero-cta{flex-direction:column;gap:14px;width:100%}.hero-cta .btn{width:100%;text-align:center}.section{padding:50px 0}.sec-head{margin-bottom:32px}.sec-head h2{font-size:26px}.feat-row{padding:32px 0}.step{grid-template-columns:1fr;gap:12px;padding:24px 0}.step-illust{width:40px;height:40px}.step-num{display:none}.how-aside{flex-direction:column;align-items:flex-start}.pricing-layout{gap:40px}.price-main .btn{width:100%}.cta{padding:50px 0}.cta-actions{flex-direction:column;gap:14px;width:100%}.cta-actions .btn{width:100%}.foot-top{flex-direction:column;gap:24px}}
      `}</style>

      <SiteHeader />

      <header className="hero">
        <div className="wrap hero-inner">
          <span className="label" style={{marginBottom:0}}>Cold email, without the guesswork</span>
          <h1>Reach more inboxes.<br /><em style={{fontStyle:"italic"}}>Skip the spam folder.</em></h1>
          <p className="hero-desc">Coldpilot warms your inbox, rotates sends, and stops when someone replies — so your outreach lands where it should.</p>
          <div className="hero-cta">
            <Link href="/auth/signup" className="btn">Start free</Link>
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

      <svg style={{position:'absolute',width:0,height:0}}>
        <defs>
          <filter id="blob"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="soft"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
          <radialGradient id="gPeach" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#F5D5C8"/><stop offset="100%" stopColor="#E8C0B0" stopOpacity=".3"/></radialGradient>
          <radialGradient id="gLavender" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#D8C8E8"/><stop offset="100%" stopColor="#C0B0D8" stopOpacity=".3"/></radialGradient>
          <radialGradient id="gSky" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#C0D8E8"/><stop offset="100%" stopColor="#A8C8E0" stopOpacity=".3"/></radialGradient>
          <radialGradient id="gMint" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#C8E0D0"/><stop offset="100%" stopColor="#B0D0B8" stopOpacity=".3"/></radialGradient>
          <radialGradient id="gRose" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#E8C8D0"/><stop offset="100%" stopColor="#D8B0C0" stopOpacity=".3"/></radialGradient>
          <radialGradient id="gSand" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#E8E0D0"/><stop offset="100%" stopColor="#D8D0C0" stopOpacity=".3"/></radialGradient>
        </defs>
      </svg>
      <section className="section" id="product">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">What's handled</span>
            <h2>Everything the big tools do.<br />Priced for one person.</h2>
            <p>Six things run in the background every time you launch a sequence.</p>
          </div>
          <div className="feat-rows">
            <div className="feat-row reveal">
              <div className="feat-text">
                <span className="feat-eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c-1 3-4 4-4 9a4 4 0 0 0 8 0c0-2-1-3-1-3s.5 2-1 3c-2 1-2-1-2-3 0-2 2-3 0-6Z"/></svg>
                  Warmup
                </span>
                <h3>Inbox warm-up</h3>
                <p>New inboxes send a slow, human-looking pattern for two weeks so mailbox providers learn to trust the address before your campaign starts.</p>
                <a href="#pricing" className="feat-link">Get started<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg></a>
              </div>
              <div className="feat-illust">
                <svg viewBox="0 0 300 210" fill="none">
                  <path d="M27 146 L55 160 L55 182 L27 168 Z" fill="#E4E2DC"/>
                  <path d="M55 160 L83 146 L83 168 L55 182 Z" fill="#D3D0C7"/>
                  <path d="M55 132 L83 146 L55 160 L27 146 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <path d="M92 126 L120 140 L120 182 L92 168 Z" fill="#E4E2DC"/>
                  <path d="M120 140 L148 126 L148 168 L120 182 Z" fill="#D3D0C7"/>
                  <path d="M120 112 L148 126 L120 140 L92 126 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <g className="feat-glow">
                    <path d="M157 102 L185 116 L185 158 L157 144 Z" fill="#BFDBFE"/>
                    <path d="M185 116 L213 102 L213 144 L185 158 Z" fill="#93C5FD"/>
                    <path d="M185 88 L213 102 L185 116 L157 102 Z" fill="#DCEAFE" stroke="#2563EB" strokeWidth="1.5"/>
                    <circle cx="185" cy="70" r="3" fill="#2563EB"/>
                    <circle cx="172" cy="60" r="2" fill="#60A5FA"/>
                    <circle cx="198" cy="58" r="2" fill="#60A5FA"/>
                  </g>
                </svg>
              </div>
            </div>

            <div className="feat-row reveal" data-side="left">
              <div className="feat-text">
                <span className="feat-eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
                  Rotation
                </span>
                <h3>Multi-inbox rotation</h3>
                <p>Connect as many inboxes as you want. Sends spread across all of them so no single address carries the volume — or the risk.</p>
                <a href="#pricing" className="feat-link">Get started<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg></a>
              </div>
              <div className="feat-illust">
                <svg viewBox="0 0 300 210" fill="none">
                  <path d="M118 60 L150 76 L150 88 L118 72 Z" fill="#E4E2DC"/>
                  <path d="M150 76 L182 60 L182 72 L150 88 Z" fill="#D3D0C7"/>
                  <path d="M150 44 L182 60 L150 76 L118 60 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <path d="M178 140 L210 156 L210 168 L178 152 Z" fill="#E4E2DC"/>
                  <path d="M210 156 L242 140 L242 152 L210 168 Z" fill="#D3D0C7"/>
                  <path d="M210 124 L242 140 L210 156 L178 140 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <g className="feat-glow">
                    <path d="M58 140 L90 156 L90 168 L58 152 Z" fill="#BFDBFE"/>
                    <path d="M90 156 L122 140 L122 152 L90 168 Z" fill="#93C5FD"/>
                    <path d="M90 124 L122 140 L90 156 L58 140 Z" fill="#DCEAFE" stroke="#2563EB" strokeWidth="1.5"/>
                  </g>
                  <path className="feat-flow" d="M138 66 C 90 90, 70 110, 88 132 M132 152 C 160 168, 190 168, 200 150 M198 68 C 168 82, 150 98, 148 118" stroke="#93C5FD" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <div className="feat-row reveal">
              <div className="feat-text">
                <span className="feat-eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 17 4 12l5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v2"/></svg>
                  Detection
                </span>
                <h3>Reply detection</h3>
                <p>The moment a lead replies, books, or bounces, their sequence stops. No awkward follow-up after they've already answered.</p>
                <a href="#pricing" className="feat-link">Get started<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg></a>
              </div>
              <div className="feat-illust">
                <svg viewBox="0 0 300 210" fill="none">
                  <rect x="88" y="118" width="124" height="72" rx="8" fill="#E4E2DC"/>
                  <rect x="96" y="106" width="124" height="72" rx="8" fill="#F1F0ED" stroke="#D3D0C7"/>
                  <path d="M96 114 L158 148 L220 114" stroke="#C7C4BA" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <g className="feat-glow">
                    <rect x="104" y="72" width="124" height="72" rx="8" fill="#DCEAFE" stroke="#2563EB" strokeWidth="1.5"/>
                    <path d="M104 80 L166 114 L228 80" stroke="#60A5FA" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <circle cx="222" cy="150" r="20" fill="#059669"/>
                  <path d="M213 150 l6 6 l12 -13" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="feat-row reveal" data-side="left">
              <div className="feat-text">
                <span className="feat-eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
                  Personalization
                </span>
                <h3>Personalization tokens</h3>
                <p>Pull first name, company, or any custom field into the subject line and body — no manual find-and-replace.</p>
                <a href="#pricing" className="feat-link">Get started<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg></a>
              </div>
              <div className="feat-illust">
                <svg viewBox="0 0 300 210" fill="none">
                  <path d="M70 60 h120 a8 8 0 0 1 8 8 v14 a12 12 0 0 0 0 24 v14 a8 8 0 0 1 -8 8 h-120 a8 8 0 0 1 -8 -8 v-52 a8 8 0 0 1 8 -8 Z" fill="#fff" stroke="#D3D0C7" strokeWidth="1.5"/>
                  <rect x="86" y="78" width="46" height="8" rx="4" fill="#D3D0C7"/>
                  <rect x="86" y="94" width="70" height="8" rx="4" fill="#E4E2DC"/>
                  <rect x="86" y="110" width="30" height="8" rx="4" fill="#E4E2DC"/>
                  <g className="feat-glow">
                    <path d="M182 66 h30 a8 8 0 0 1 8 8 v14 a12 12 0 0 0 0 24 v14 a8 8 0 0 1 -8 8 h-30 a8 8 0 0 1 -8 -8 v-52 a8 8 0 0 1 8 -8 Z" fill="#DCEAFE" stroke="#2563EB" strokeWidth="1.5"/>
                    <text x="197" y="118" textAnchor="middle" fontSize="10" fontWeight="600" fill="#1D4ED8" transform="rotate(90 197 118)">Ari</text>
                  </g>
                </svg>
              </div>
            </div>

            <div className="feat-row reveal">
              <div className="feat-text">
                <span className="feat-eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6l-9-4Z"/></svg>
                  Deliverability
                </span>
                <h3>Deliverability monitor</h3>
                <p>A spam-score check runs before every send, so you catch a flagged domain or spammy subject line before your leads do.</p>
                <a href="#pricing" className="feat-link">Get started<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg></a>
              </div>
              <div className="feat-illust">
                <svg viewBox="0 0 300 210" fill="none">
                  <circle className="feat-pulse" cx="150" cy="120" r="15" fill="none" stroke="#60A5FA" strokeWidth="2"/>
                  <circle className="feat-pulse" cx="150" cy="120" r="15" fill="none" stroke="#60A5FA" strokeWidth="2" style={{animationDelay:"1.3s"}}/>
                  <path d="M118 120 L150 136 L150 148 L118 132 Z" fill="#E4E2DC"/>
                  <path d="M150 136 L182 120 L182 132 L150 148 Z" fill="#D3D0C7"/>
                  <g className="feat-glow">
                    <path d="M150 104 L182 120 L150 136 L118 120 Z" fill="#DCEAFE" stroke="#2563EB" strokeWidth="1.5"/>
                    <path d="M138 118 l7 7 l14 -15" stroke="#1D4ED8" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                </svg>
              </div>
            </div>

            <div className="feat-row reveal" data-side="left">
              <div className="feat-text">
                <span className="feat-eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/></svg>
                  Analytics
                </span>
                <h3>Plain analytics</h3>
                <p>Opens, replies, and bounces on one screen. Just what you need to know if the sequence is working.</p>
                <a href="#pricing" className="feat-link">Get started<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg></a>
              </div>
              <div className="feat-illust">
                <svg viewBox="0 0 300 210" fill="none">
                  <path d="M27 146 L55 160 L55 182 L27 168 Z" fill="#E4E2DC"/>
                  <path d="M55 160 L83 146 L83 168 L55 182 Z" fill="#D3D0C7"/>
                  <path d="M55 132 L83 146 L55 160 L27 146 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <path d="M92 126 L120 140 L120 182 L92 168 Z" fill="#E4E2DC"/>
                  <path d="M120 140 L148 126 L148 168 L120 182 Z" fill="#D3D0C7"/>
                  <path d="M120 112 L148 126 L120 140 L92 126 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <path d="M157 102 L185 116 L185 168 L157 154 Z" fill="#E4E2DC"/>
                  <path d="M185 116 L213 102 L213 154 L185 168 Z" fill="#D3D0C7"/>
                  <path d="M185 88 L213 102 L185 116 L157 102 Z" fill="#F1F0ED" stroke="#C7C4BA"/>
                  <g className="feat-glow">
                    <path d="M222 72 L250 86 L250 182 L222 168 Z" fill="#BFDBFE"/>
                    <path d="M250 86 L278 72 L278 168 L250 182 Z" fill="#93C5FD"/>
                    <path d="M250 58 L278 72 L250 86 L222 72 Z" fill="#DCEAFE" stroke="#2563EB" strokeWidth="1.5"/>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head center">
            <span className="label">Why founders switch</span>
            <h2>Built for one person running outreach</h2>
          </div>
          <div className="why-grid">
            <div className="why-item"><h3>Half the price</h3><p>Roughly half of what comparable tools charge for the same feature set.</p></div>
            <div className="why-item"><h3>No add-on tax</h3><p>AI and email verification included on every paid plan — not upsold as separate products.</p></div>
            <div className="why-item"><h3>Unlimited inboxes</h3><p>Every paid plan connects as many inboxes as you want. No per-mailbox fees.</p></div>
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
            <li className="step">
              <div className="step-illust"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
              <div><h3>Connect your inbox</h3><p>Link Gmail or Outlook. Warm-up starts immediately, even before your first sequence.</p></div>
            </li>
            <li className="step">
              <div className="step-illust"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 3v18"/><path d="M13 13h4"/><path d="M13 17h4"/></svg></div>
              <div><h3>Import your leads</h3><p>Upload a CSV or paste a list. Map columns once and you're set.</p></div>
            </li>
            <li className="step">
              <div className="step-illust"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
              <div><h3>Write your sequence</h3><p>First email, follow-ups, delays. Tokens pull from your lead list.</p></div>
            </li>
            <li className="step">
              <div className="step-illust"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></div>
              <div><h3>Launch and track</h3><p>Sends rotate across connected inboxes automatically. Watch replies come in.</p></div>
            </li>
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
            <h2>Pro features. Half the price.</h2>
            <p>AI and verification included — not sold as add-ons.</p>
          </div>
          <div className="pricing-layout" id="compare">
            <div className="price-main">
              <span className="label">Coldpilot</span>
              <div className="amount" style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:"clamp(56px,10vw,80px)",lineHeight:1,marginTop:16}}>$19<span style={{fontSize:"clamp(16px,2vw,20px)",fontFamily:"'JetBrains Mono',monospace",color:"var(--muted-2)"}}> /mo</span></div>
              <p className="desc">Starter — 5,000 leads, unlimited inboxes, and AI email generation. For one person running outreach.</p>
              <ul className="price-includes">
                <li>Unlimited connected inboxes</li>
                <li>Automatic warm-up on every account</li>
                <li>AI email generation</li>
                <li>Reply detection and auto-stop</li>
                <li>Deliverability checks before every send</li>
              </ul>
              <Link href="/auth/signup" className="btn" style={{marginTop:36,display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",fontSize:14,fontWeight:500,padding:"13px 26px",borderRadius:6,border:"none",cursor:"pointer",background:"var(--blue)",color:"#fff",textDecoration:"none"}}>Start free</Link>
            </div>
            <div>
              <span className="label">Every tier</span>
              <ul className="compare-list" style={{marginTop:16}}>
                <li className="compare-row"><div><div className="name">Free</div><div className="desc">2 inboxes · 300 leads · 1,000 free credits</div></div><div className="cost">$0</div></li>
                <li className="compare-row highlight"><div><div className="name">Starter</div><div className="desc">Unlimited inboxes · 5,000 leads · AI included</div></div><div className="cost">$19</div></li>
                <li className="compare-row"><div><div className="name">Pro</div><div className="desc">Unlimited inboxes · 30,000 leads · AI included</div></div><div className="cost">$49</div></li>
                <li className="compare-row"><div><div className="name">Agency</div><div className="desc">Unlimited inboxes · 150,000 leads · white-label &amp; API</div></div><div className="cost">$99</div></li>
              </ul>
              <p className="compare-note">AI included in every paid plan, and every account starts with 1,000 free credits. See the full <Link href="/pricing" className="feat-link" style={{display:"inline-flex",alignItems:"center",gap:4}}>pricing<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><path d="M9 6l6 6-6 6"/></svg></Link>.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="quote-block">
          <blockquote>I built Coldpilot because every tool wanted <em style={{fontStyle:"italic"}}>$47 to start</em> and another charge for leads before I'd sent a single email.</blockquote>
          <p className="quote-attr">— Builder's note</p>
        </div>
      </div>

      <section className="cta">
        <div className="wrap cta-inner">
          <span className="label" style={{marginBottom:0}}>Ready when you are</span>
          <h2>Connect an inbox.<br />Send your first sequence today.</h2>
          <p>Free to start, cancel anytime. No credit card needed.</p>
          <div className="cta-actions">
            <Link href="/auth/signup" className="btn">Start free</Link>
            <a href="#how" className="text-link">See how it works</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand"><div className="logo">Coldpilot</div><p>Cold email for solo founders. One flat price, nothing bolted on.</p></div>
            <div className="foot-links">
              <div className="foot-col"><h4>Product</h4><ul><li><a href="#product">Features</a></li><li><a href="#how">How it works</a></li><li><Link href="/pricing">Pricing</Link></li></ul></div>
              <div className="foot-col"><h4>Company</h4><ul><li><Link href="/about">About</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
              <div className="foot-col"><h4>Legal</h4><ul><li><Link href="/legal/privacy">Privacy</Link></li><li><Link href="/legal/terms">Terms</Link></li></ul></div>
            </div>
          </div>
          <div className="foot-bottom"><span>&copy; 2026 Coldpilot.</span><span>Made for the inbox, not the spam folder.</span></div>
        </div>
      </footer>

      <Script id="landing-js">{`
        (function(){
          if(!matchMedia("(prefers-reduced-motion:reduce)").matches){
            var ro=new IntersectionObserver(function(e){e.forEach(function(ee){if(ee.isIntersecting){ee.target.classList.add("in");ro.unobserve(ee.target)}})},{threshold:0.08,rootMargin:"0px 0px -40px 0px"});
            document.querySelectorAll(".reveal").forEach(function(el){ro.observe(el)});
          }
        })();
      `}</Script>
    </div>
  );
}
