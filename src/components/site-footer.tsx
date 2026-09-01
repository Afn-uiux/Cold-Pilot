import Link from "next/link";
import Logo from "@/components/logo";

export default function SiteFooter() {
  return (
    <footer className="sf">
      <div className="sf-inner">
        <div className="sf-top">
          <div className="sf-brand"><div className="sf-logo"><Logo height={22} /></div><p>Cold email for solo founders. One flat price, nothing bolted on.</p></div>
          <div className="sf-links">
            <div className="sf-col"><h4>Product</h4><ul>
              <li><Link href="/warmup">Warmup</Link></li>
              <li><Link href="/rotation">Rotation</Link></li>
              <li><Link href="/reply-detection">Reply detection</Link></li>
              <li><Link href="/deliverability">Deliverability</Link></li>
              <li><Link href="/analytics">Analytics</Link></li>
            </ul></div>
            <div className="sf-col"><h4>Use cases</h4><ul>
              <li><Link href="/use-cases/founders">Founders</Link></li>
              <li><Link href="/use-cases/agencies">Agencies</Link></li>
              <li><Link href="/use-cases/sales">Sales teams</Link></li>
              <li><Link href="/use-cases/recruiters">Recruiters</Link></li>
              <li><Link href="/use-cases/fundraising">Fundraising</Link></li>
            </ul></div>
            <div className="sf-col"><h4>Company</h4><ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/docs">Docs</Link></li>
            </ul></div>
            <div className="sf-col"><h4>Legal</h4><ul>
              <li><Link href="/legal/privacy">Privacy</Link></li>
              <li><Link href="/legal/terms">Terms</Link></li>
            </ul></div>
          </div>
        </div>
        <div className="sf-bottom"><span>&copy; 2026 Coldpilot.</span><span>Made for the inbox, not the spam folder.</span></div>
      </div>
      <style>{`
        .sf{--cream:#FAFAF8;--ink:#0F0D14;--muted:#6B6578;--muted-2:#9B94A8;--border:rgba(15,13,20,0.08);padding:48px 0 32px;border-top:1px solid var(--border);font-family:'Geist',system-ui,sans-serif;background:var(--cream);color:var(--ink)}
        .sf-inner{max-width:1080px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
        .sf-top{display:flex;justify-content:space-between;align-items:flex-start;gap:40px;flex-wrap:wrap;margin-bottom:48px}
        .sf-brand .sf-logo{font-family:"Instrument Serif",serif;font-size:20px;margin-bottom:10px}
        .sf-brand p{font-size:14px;max-width:220px;color:var(--muted);line-height:1.7}
        .sf-links{display:flex;gap:clamp(40px,8vw,80px);flex-wrap:wrap}
        .sf-col h4{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:14px}
        .sf-col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
        .sf-col a{font-size:14px;color:var(--muted)}
        .sf-col a:hover{color:var(--ink)}
        .sf-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:24px;border-top:1px solid var(--border);font-size:13px;color:var(--muted-2)}
        @media(max-width:640px){.sf-top{flex-direction:column;gap:24px}}
      `}</style>
    </footer>
  );
}
