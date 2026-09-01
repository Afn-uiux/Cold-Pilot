import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export default function MarketingPage({
  label,
  title,
  desc,
  children,
}: {
  label: string;
  title: React.ReactNode;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mp">
      <SiteHeader />
      <header className="mp-hero">
        <div className="wrap mp-hero-inner">
          <span className="label" style={{ marginBottom: 0 }}>{label}</span>
          <h1>{title}</h1>
          <p className="mp-desc">{desc}</p>
          <div className="mp-cta">
            <Link href="/auth/signup" className="btn" style={{ background: "var(--blue)", color: "#fff", padding: "13px 26px", fontSize: 14, borderRadius: 6, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontWeight: 500, border: "none", cursor: "pointer" }}>Start free</Link>
            <Link href="/auth/login" className="mp-login">Log in</Link>
          </div>
        </div>
      </header>
      {children}
      <section className="mp-cta-section">
        <div className="wrap mp-cta-inner">
          <span className="label" style={{ marginBottom: 0 }}>Ready when you are</span>
          <h2>Connect an inbox.<br />Send your first sequence today.</h2>
          <p>Free to start, cancel anytime. No credit card needed.</p>
          <div className="mp-cta">
            <Link href="/auth/signup" className="btn" style={{ background: "var(--blue)", color: "#fff", padding: "13px 26px", fontSize: 14, borderRadius: 6, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontWeight: 500, border: "none", cursor: "pointer" }}>Start free</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
      <style>{`
        .mp{--cream:#FAFAF8;--ink:#0F0D14;--muted:#6B6578;--muted-2:#9B94A8;--border:rgba(15,13,20,0.08);--blue:#2563EB;--blue-hover:#1D4ED8;font-family:'Geist',system-ui,sans-serif;background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased;overflow:clip;min-height:100vh}
        .mp .wrap{max-width:1080px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
        .mp-hero{padding:clamp(64px,10vw,110px) 0;border-bottom:1px solid var(--border);background-image:linear-gradient(to right,rgba(15,13,20,0.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(15,13,20,0.03) 1px,transparent 1px);background-size:32px 32px}
        .mp-hero-inner{max-width:640px;margin:0 auto;text-align:center}
        .mp-hero h1{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(36px,6vw,56px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:24px;text-wrap:balance}
        .mp-desc{margin:26px auto 0;font-size:17px;max-width:480px;color:var(--muted);line-height:1.7}
        .mp-cta{display:flex;align-items:center;justify-content:center;gap:22px;margin-top:36px;flex-wrap:wrap}
        .mp-login{font-size:15px;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:2px}
        .mp-login:hover{color:var(--ink)}
        .mp-body{padding:clamp(64px,10vw,110px) 0;border-bottom:1px solid var(--border)}
        .mp-body-inner{max-width:640px;margin:0 auto}
        .mp-body h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(26px,3.5vw,34px);font-weight:400;line-height:1.1;letter-spacing:-.02em;margin-bottom:20px}
        .mp-body p{font-size:16px;color:var(--muted);line-height:1.75;margin-bottom:16px}
        .mp-body ul{list-style:none;margin-top:24px;display:flex;flex-direction:column;gap:14px}
        .mp-body li{font-size:15px;color:var(--ink);padding-left:22px;position:relative;line-height:1.6}
        .mp-body li::before{content:"—";position:absolute;left:0;color:var(--muted-2)}
        .mp-cta-section{padding:clamp(64px,10vw,110px) 0;text-align:center}
        .mp-cta-inner{max-width:520px;margin:0 auto}
        .mp-cta-section h2{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.5vw,44px);font-weight:400;line-height:1.08;letter-spacing:-.02em;margin-top:16px}
        .mp-cta-section p{margin-top:16px;font-size:16px;color:var(--muted);line-height:1.7}
        ::selection{background:var(--blue);color:#fff}
        @media(max-width:640px){.mp-hero{padding:56px 0 48px}.mp-hero h1{font-size:30px;margin-top:16px}.mp-desc{font-size:15px}.mp-cta{flex-direction:column;gap:14px}.mp-body{padding:56px 0}.mp-cta-section{padding:56px 0}}
      `}</style>
    </div>
  );
}
