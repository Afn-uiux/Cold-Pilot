"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Logo from "@/components/logo";
import { IconTarget } from "@/components/icon-target";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";
import { Menu01Icon } from "@/components/icons/menu-01";
import { Cancel01Icon } from "@/components/icons/cancel-01";
import { FlameIcon } from "@/components/icons/flame";
import { RefreshIcon } from "@/components/icons/refresh";
import { MailOpenIcon } from "@/components/icons/mail-open";
import { MagicWand01Icon } from "@/components/icons/magic-wand-01";
import { Shield02Icon } from "@/components/icons/shield-02";
import { TrendUpIcon } from "@/components/icons/trend-up";
import { RocketIcon } from "@/components/icons/rocket";
import { BriefcaseIcon } from "@/components/icons/briefcase";
import { UserGroupIcon } from "@/components/icons/user-group";
import { Search01Icon } from "@/components/icons/search-01";
import { StarIcon } from "@/components/icons/star";
import { PlusSignIcon } from "@/components/icons/plus-sign";

const products = [
  { icon: <FlameIcon size={15} />, href: "/warmup", title: "Warmup", desc: "New inboxes send a slow, human-looking pattern for two weeks so providers learn to trust the address before you launch." },
  { icon: <RefreshIcon size={15} />, href: "/rotation", title: "Rotation", desc: "Connect as many inboxes as you want. Sends spread across all of them so no single address carries the volume." },
  { icon: <MailOpenIcon size={15} />, href: "/reply-detection", title: "Reply detection", desc: "The moment a lead replies, books, or bounces, their sequence stops. No awkward follow-up after they've answered." },
  { icon: <MagicWand01Icon size={15} />, href: "/personalization", title: "Personalization", desc: "Pull first name, company, or any custom field into the subject line and body — no manual find-and-replace." },
  { icon: <Shield02Icon size={15} />, href: "/deliverability", title: "Deliverability", desc: "A spam-score check runs before every send, so you catch a flagged domain before your leads do." },
  { icon: <TrendUpIcon size={15} />, href: "/analytics", title: "Analytics", desc: "Opens, replies, and bounces on one screen. Just what you need to know if the sequence is working." },
];

const useCases = [
  { icon: <RocketIcon size={15} />, href: "/use-cases/founders", title: "Founders", desc: "Run intro sequences without burning founder@." },
  { icon: <BriefcaseIcon size={15} />, href: "/use-cases/agencies", title: "Agencies", desc: "Outbound for many clients on many domains." },
  { icon: <UserGroupIcon size={15} />, href: "/use-cases/sales", title: "Sales teams", desc: "Distribute sends across reps, surface positives." },
  { icon: <Search01Icon size={15} />, href: "/use-cases/recruiters", title: "Recruiters", desc: "Candidate outreach from personal mailboxes." },
  { icon: <StarIcon size={15} />, href: "/use-cases/fundraising", title: "Fundraising", desc: "A focused sequence that lands in the inbox." },
  { icon: <PlusSignIcon size={15} />, href: "/use-cases", title: "And many more", desc: "Freelancers, growth, e-commerce, consultants — and everyone else sending cold email." },
];

function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MegaItem({ item }: { item: { icon: ReactNode; href: string; title: string; desc: string } }) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  return (
    <Link
      href={item.href}
      className="sh-item"
      role="menuitem"
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onClick={() => iconRef.current?.startAnimation()}
    >
      <div className="sh-item-head">
        <span className="sh-item-ic"><IconTarget triggerRef={iconRef} className="flex items-center">{item.icon}</IconTarget></span>
        <span className="sh-item-title">{item.title}</span>
      </div>
      <p>{item.desc}</p>
    </Link>
  );
}

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [acc, setAcc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const header = document.getElementById("sh-header");
    const onScroll = () => header?.classList.toggle("sh-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    const onResize = () => { if (window.innerWidth > 860) setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const toggleAcc = (key: string) => setAcc((p) => ({ ...p, [key]: !p[key] }));

  return (
    <>
      <header className="sh" id="sh-header">
        <div className="sh-inner">
          <Link href="/" className="sh-logo"><Logo height={22} /></Link>

          <nav className="sh-nav">
            <div className="sh-mega" data-mega>
              <a href="/warmup" className="sh-link sh-trigger">
                Product
                <Caret />
              </a>
              <div className="sh-panel" role="menu">
                <div className="sh-panel-inner">
                  <div className="sh-panel-grid">
                    <div className="sh-panel-intro">
                      <div className="sh-panel-label">Product</div>
                      <h3>Everything the big tools do.<br />Priced for one person.</h3>
                      <p>Six things run in the background every time you launch a sequence.</p>
                      <Link href="/#product" className="sh-panel-link">See all features<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></Link>
                    </div>
                    <div className="sh-panel-items">
                      {products.map((p) => (
                        <MegaItem key={p.href} item={p} />
                      ))}
                    </div>
                  </div>
                  <div className="sh-panel-foot">
                    <Link href="/blog">Blog</Link>
                    <Link href="/docs">Docs</Link>
                    <Link href="/deliverability">Deliverability</Link>
                    <Link href="/auth/signup" className="sh-foot-cta">Start free</Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="sh-mega" data-mega>
              <a href="/use-cases/founders" className="sh-link sh-trigger">
                Use cases
                <Caret />
              </a>
              <div className="sh-panel" role="menu">
                <div className="sh-panel-inner">
                  <div className="sh-panel-grid">
                    <div className="sh-panel-intro">
                      <div className="sh-panel-label">Use cases</div>
                      <h3>Built for one person<br />running outreach.</h3>
                      <p>Founders, agencies, sales teams, recruiters, fundraising — and anyone else running cold outreach.</p>
                      <Link href="/use-cases" className="sh-panel-link">View all use cases<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></Link>
                    </div>
                    <div className="sh-panel-items">
                      {useCases.map((p) => (
                        <MegaItem key={p.href} item={p} />
                      ))}
                    </div>
                  </div>
                  <div className="sh-panel-foot">
                    <Link href="/deliverability">Deliverability</Link>
                    <Link href="/blog">Blog</Link>
                    <Link href="/docs">Docs</Link>
                    <Link href="/auth/signup" className="sh-foot-cta">Start free</Link>
                  </div>
                </div>
              </div>
            </div>

            <Link href="/deliverability" className="sh-link">Deliverability</Link>
            <Link href="/blog" className="sh-link">Blog</Link>
            <Link href="/docs" className="sh-link">Docs</Link>
          </nav>

          <div className="sh-actions">
            <Link href="/auth/login" className="sh-login">Log in</Link>
            <Link href="/auth/signup" className="sh-cta">Start free</Link>
          </div>

          <button
            type="button"
            className="sh-toggle"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-controls="sh-mobile"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <Menu01Icon size={22} />
          </button>
        </div>
      </header>

      {mobileOpen && (
      <div className="sh-mobile sh-mobile-open" id="sh-mobile" aria-hidden={!mobileOpen} onClick={() => setMobileOpen(false)}>
        <div className="sh-mobile-panel" role="dialog" aria-modal="true" aria-label="Navigation menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="sh-mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
            <Cancel01Icon size={20} />
          </button>

          <button type="button" className="sh-acc-trigger" aria-expanded={!!acc.product} onClick={() => toggleAcc("product")}>
            Product
            <svg className="sh-acc-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div className={`sh-acc-panel${acc.product ? " open" : ""}`}>
            <div>
              {products.map((p) => (
                <Link key={p.href} href={p.href} className="sh-mobile-item" onClick={() => setMobileOpen(false)}>
                  <span className="sh-mobile-item-title">{p.title}</span>
                  <span className="sh-mobile-item-desc">{p.desc}</span>
                </Link>
              ))}
            </div>
          </div>

          <button type="button" className="sh-acc-trigger" aria-expanded={!!acc.useCases} onClick={() => toggleAcc("useCases")}>
            Use cases
            <svg className="sh-acc-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div className={`sh-acc-panel${acc.useCases ? " open" : ""}`}>
            <div>
              {useCases.map((p) => (
                <Link key={p.href} href={p.href} className="sh-mobile-item" onClick={() => setMobileOpen(false)}>
                  <span className="sh-mobile-item-title">{p.title}</span>
                  <span className="sh-mobile-item-desc">{p.desc}</span>
                </Link>
              ))}
            </div>
          </div>

          <Link href="/deliverability" className="sh-mobile-link" onClick={() => setMobileOpen(false)}>Deliverability</Link>
          <Link href="/blog" className="sh-mobile-link" onClick={() => setMobileOpen(false)}>Blog</Link>
          <Link href="/docs" className="sh-mobile-link" onClick={() => setMobileOpen(false)}>Docs</Link>

          <div className="sh-mobile-actions">
            <Link href="/auth/login" className="sh-mobile-btn sh-mobile-btn-ghost" onClick={() => setMobileOpen(false)}>Log in</Link>
            <Link href="/auth/signup" className="sh-mobile-btn" onClick={() => setMobileOpen(false)}>Start free</Link>
          </div>
        </div>
      </div>
      )}

      <style>{`
        .sh{--cream:#FAFAF8;--ink:#0F0D14;--muted:#6B6578;--muted-2:#9B94A8;--border:rgba(15,13,20,0.08);--blue:#2563EB;--blue-hover:#1D4ED8;position:sticky;top:0;z-index:100;background:rgba(250,250,248,0.92);backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s}
        .sh.sh-scrolled{border-bottom-color:var(--border)}
        .sh-inner{max-width:1080px;margin:0 auto;padding:16px clamp(20px,4vw,40px);display:flex;align-items:center;justify-content:space-between;gap:20px}
        .sh-logo{font-family:"Instrument Serif",serif;font-size:20px;color:var(--ink);white-space:nowrap}
        .sh-nav{display:flex;align-items:center;gap:2px}
        .sh-link{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:7px;font-size:14px;color:var(--muted);transition:color .15s,background .15s;white-space:nowrap}
        .sh-link:hover{color:var(--ink);background:rgba(15,13,20,0.05)}
        .sh-mega{position:static}
        .sh-mega.open .sh-link{color:var(--ink);background:rgba(15,13,20,0.05)}
        .sh-mega.open .sh-trigger svg{transform:rotate(180deg)}
        .sh-trigger svg{transition:transform .2s}
        .sh-panel{position:absolute;top:100%;left:0;right:0;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .16s ease,transform .2s cubic-bezier(.22,1,.36,1),visibility .16s;z-index:90}
        .sh-mega:hover .sh-panel,.sh-mega:focus-within .sh-panel,.sh-mega.open .sh-panel{opacity:1;visibility:visible;transform:translateY(0)}
        .sh-panel-inner{background:#fff;border:1px solid var(--border);border-top:none;box-shadow:0 40px 90px -30px rgba(2,32,71,.25),0 12px 36px -10px rgba(15,23,42,.08)}
        .sh-panel-grid{display:grid;grid-template-columns:300px 1fr;max-width:1080px;margin:0 auto}
        .sh-panel-intro{padding:40px 44px;border-right:1px solid var(--border)}
        .sh-panel-label{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted-2)}
        .sh-panel-intro h3{font-family:"Instrument Serif",Georgia,serif;font-size:30px;font-weight:400;line-height:1.06;letter-spacing:-.02em;margin-top:14px;color:var(--ink)}
        .sh-panel-intro p{margin-top:14px;font-size:14px;color:var(--muted);line-height:1.65;max-width:240px}
        .sh-panel-link{display:inline-flex;align-items:center;gap:6px;margin-top:22px;font-size:12.5px;font-weight:500;color:var(--blue)}
        .sh-panel-link:hover{color:var(--blue-hover)}
        .sh-panel-link svg{transition:transform .15s}
        .sh-panel-link:hover svg{transform:translateX(3px)}
        .sh-panel-items{display:grid;grid-template-columns:repeat(3,1fr)}
        .sh-item{display:flex;flex-direction:column;gap:8px;padding:22px 24px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);transition:background .14s}
        .sh-item:nth-child(3n){border-right:none}
        .sh-item:nth-child(n+4){border-bottom:none}
        .sh-item:hover{background:#F6F5F2}
        .sh-item-head{display:flex;align-items:center;gap:9px}
        .sh-item-ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;background:rgba(37,99,235,.09);color:var(--blue);flex-shrink:0}
        .sh-item-title{font-size:15px;font-weight:600;color:var(--ink)}
        .sh-item p{font-size:12.5px;color:var(--muted);line-height:1.55}
        .sh-panel-foot{border-top:1px solid var(--border);background:#F6F5F2}
        .sh-panel-foot{display:flex;align-items:center;gap:24px;max-width:1080px;margin:0 auto;padding:12px clamp(24px,4vw,44px)}
        .sh-panel-foot a{font-size:12.5px;color:var(--muted)}
        .sh-panel-foot a:hover{color:var(--ink)}
        .sh-panel-foot .sh-foot-cta{margin-left:auto;color:var(--blue);font-weight:500}
        .sh-actions{display:flex;align-items:center;gap:18px;margin-left:auto}
        .sh-login{font-size:14px;color:var(--muted);white-space:nowrap}
        .sh-login:hover{color:var(--ink)}
        .sh-cta{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:13.5px;font-weight:500;padding:10px 20px;border-radius:6px;background:var(--blue);color:#fff;white-space:nowrap;transition:background .15s}
        .sh-cta:hover{background:var(--blue-hover)}
        .sh-toggle{display:none;align-items:center;justify-content:center;width:44px;height:44px;background:none;border:none;color:var(--ink);cursor:pointer;padding:0;z-index:110;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
        .sh-toggle>div,.sh-mobile-close>div{pointer-events:none;display:flex}
        .sh-mobile-close{align-self:flex-end;display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:none;border:1px solid var(--border);border-radius:8px;padding:0;cursor:pointer;color:var(--ink);touch-action:manipulation}
        @media(max-width:860px){.sh-nav{display:none}.sh-actions{display:none}.sh-toggle{display:flex!important}}

        .sh-mobile{position:fixed;inset:0;z-index:200;background:rgba(15,13,20,0.4);opacity:1;pointer-events:auto;animation:shFadeIn .3s ease}
        @keyframes shFadeIn{from{opacity:0}to{opacity:1}}
        .sh-mobile-panel{position:absolute;top:0;left:0;right:0;width:100%;max-height:100dvh;background:var(--cream,#FAFAF8);border-bottom:1px solid var(--border);padding:calc(16px + env(safe-area-inset-top)) clamp(20px,4vw,28px) calc(22px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:2px;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 30px 60px -20px rgba(15,13,20,.25);border-radius:0 0 18px 18px;animation:shSlideDown .4s cubic-bezier(.16,1,.3,1)}
        @keyframes shSlideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}
        .sh-acc-trigger{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;border-bottom:1px solid var(--border);padding:15px 2px;font-family:inherit;font-size:16px;font-weight:500;color:var(--ink);cursor:pointer;text-align:left;touch-action:manipulation}
        .sh-acc-caret{color:var(--muted-2);transition:transform .24s ease}
        .sh-acc-trigger[aria-expanded="true"] .sh-acc-caret{transform:rotate(180deg)}
        .sh-acc-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.22,1,.36,1)}
        .sh-acc-panel.open{grid-template-rows:1fr}
        .sh-acc-panel>div{overflow:hidden}
        .sh-mobile-item{display:flex;flex-direction:column;gap:3px;padding:12px 4px}
        .sh-mobile-item-title{font-size:15px;font-weight:500;color:var(--ink)}
        .sh-mobile-item-desc{font-size:12.5px;color:var(--muted);line-height:1.5}
        .sh-mobile-link{display:block;border-bottom:1px solid var(--border);padding:15px 2px;font-size:16px;font-weight:500;color:var(--ink)}
        .sh-mobile-actions{display:flex;flex-direction:column;gap:10px;margin-top:auto;padding-top:20px}
        .sh-mobile-btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:15px;font-weight:500;padding:14px 26px;border-radius:6px;background:var(--blue);color:#fff;text-decoration:none}
        .sh-mobile-btn-ghost{background:#fff;color:var(--ink);border:1px solid var(--border)}
        @media(max-width:420px){.sh-inner{padding:12px 16px}.sh-mobile-panel{border-radius:0;padding-left:18px;padding-right:18px}.sh-mobile-item-desc{font-size:12px}.sh-mobile-actions{padding-top:14px}}
        @media(prefers-reduced-motion:reduce){.sh-panel,.sh-mobile,.sh-mobile-panel,.sh-acc-panel,.sh-acc-caret{transition:none}}
      `}</style>
    </>
  );
}
