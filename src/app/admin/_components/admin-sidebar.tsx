"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/users", label: "Users", icon: "users" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-50"
      style={{ width: 200, background: "var(--color-cream)", borderRight: "1px solid var(--color-border)", padding: "28px 0" }}
    >
      <div className="font-medium text-lg tracking-tight px-6 mb-9">
        <Link href="/admin">Coldpilot</Link>
        <span className="text-[10px] tracking-widest uppercase text-muted-2 ml-2">Admin</span>
      </div>

      <div className="font-medium text-[10px] tracking-widest uppercase text-muted-2 px-6 pb-2">Menu</div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {LINKS.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-6 py-2.5 text-sm relative transition-colors ${
                isActive ? "text-blue-accent" : "text-muted hover:text-blue-accent"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-accent rounded-r-sm" />
              )}
              <NavIcon name={link.icon} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-3 border-t border-border px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 py-2.5 text-sm text-muted hover:text-blue-accent transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to App
        </Link>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const props = { width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...props} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "users": return <svg {...props} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    default: return null;
  }
}
