"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "home" },
  { href: "/dashboard/email-accounts", label: "Email Accounts", icon: "mail" },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: "chart" },
  { href: "/dashboard/inbox", label: "Coldbox", icon: "inbox" },
  { href: "/dashboard/crm", label: "CRM", icon: "users" },
  { href: "/dashboard/settings", label: "Settings", icon: "gear" },
];

const adminItem = { href: "/admin", label: "Admin", icon: "shield" };

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    function fetchUnread() {
      fetch("/api/inbox/unread-count")
        .then(r => r.json())
        .then(data => { if (active && typeof data.count === "number") setUnreadCount(data.count); })
        .catch(() => {});
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 20000);
    return () => { active = false; clearInterval(interval); };
    // Re-poll immediately whenever the route changes (e.g. right after
    // leaving the inbox, once the lead's lastReadAt has been updated).
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-cream border border-border rounded-lg p-2.5 shadow-sm"
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen flex flex-col bg-cream z-50 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{ width: 200, borderRight: "1px solid var(--color-border)", padding: "28px 0" }}
      >
        <div className="font-medium text-lg tracking-tight px-6 mb-9 flex items-center justify-between">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)}>Coldpilot</Link>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-muted hover:text-blue-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        <div className="font-medium text-[10px] tracking-widest uppercase text-muted-2 px-6 pb-2">Menu</div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm relative transition-colors ${
                  isActive ? "text-blue-accent" : "text-muted hover:text-blue-accent"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-accent rounded-r-sm" />
                )}
                <NavIcon name={item.icon} />
                {item.label}
                {item.href === "/dashboard/inbox" && unreadCount > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-accent text-white text-[10px] font-medium leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
          {(user as any).role === "admin" && (() => {
            const item = adminItem;
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm relative transition-colors ${
                  isActive ? "text-blue-accent" : "text-muted hover:text-blue-accent"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-accent rounded-r-sm" />
                )}
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })()}
        </nav>

        <div className="pt-3 border-t border-border px-6">
          <a
            href="/api/auth/signout"
            className="flex items-center gap-3 py-2.5 text-sm text-muted hover:text-blue-accent transition-colors w-full text-left"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </a>
        </div>
      </aside>
    </>
  );
}

function NavIcon({ name }: { name: string }) {
  const props = { width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...props} viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
    case "mail": return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>;
    case "chart": return <svg {...props} viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>;
    case "users": return <svg {...props} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "inbox": return <svg {...props} viewBox="0 0 24 24"><path d="M22 12h-5l-2 3H9l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
    case "trend": return <svg {...props} viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case "file": return <svg {...props} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "gear": return <svg {...props} viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "folder": return <svg {...props} viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case "shield": return <svg {...props} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  }
}
