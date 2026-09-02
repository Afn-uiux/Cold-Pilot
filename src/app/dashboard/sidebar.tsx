"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import Link from "next/link";
import Logo from "@/components/logo";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home01Icon } from "@/components/icons/home-01";
import { Mail01Icon } from "@/components/icons/mail-01";
import { SentIcon } from "@/components/icons/sent";
import { InboxIcon } from "@/components/icons/inbox";
import { UserGroupIcon } from "@/components/icons/user-group";
import { Settings01Icon } from "@/components/icons/settings-01";
import { Shield02Icon } from "@/components/icons/shield-02";
import { Logout01Icon } from "@/components/icons/logout-01";
import { Menu01Icon } from "@/components/icons/menu-01";
import { Cancel01Icon } from "@/components/icons/cancel-01";
import { IconTarget } from "@/components/icon-target";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";

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
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-cream border border-border rounded-lg p-2.5 shadow-sm [&>div]:pointer-events-none"
        aria-label="Open menu"
      >
        <IconTarget className="flex items-center"><Menu01Icon size={18} /></IconTarget>
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
        className={`fixed top-0 left-0 h-[100dvh] flex flex-col bg-cream z-50 transition-transform duration-200 overflow-y-auto ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{ width: 200, borderRight: "1px solid var(--color-border)", padding: "28px 0" }}
      >
        <div className="font-medium text-lg tracking-tight px-6 mb-9 flex items-center justify-between">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="leading-none"><Logo height={18} /></Link>
          <button type="button" onClick={() => setMobileOpen(false)} className="lg:hidden text-muted hover:text-blue-accent [&>div]:pointer-events-none">
            <IconTarget className="flex items-center"><Cancel01Icon size={16} /></IconTarget>
          </button>
        </div>

        <div className="font-medium text-[10px] tracking-widest uppercase text-muted-2 px-6 pb-2">Menu</div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<NavIcon name={item.icon} />}
                isActive={isActive}
                badge={item.href === "/dashboard/inbox" && unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : null}
                onClick={() => setMobileOpen(false)}
              />
            );
          })}
          {(user as any).role === "admin" && (() => {
            const item = adminItem;
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<NavIcon name={item.icon} />}
                isActive={isActive}
                onClick={() => setMobileOpen(false)}
              />
            );
          })()}
        </nav>

        <div className="pt-3 border-t border-border px-6">
          <button
            type="button"
            onClick={() => signOut({ redirect: false }).finally(() => { window.location.href = "/auth/login"; })}
            className="flex items-center gap-3 py-2.5 text-sm text-muted hover:text-blue-accent transition-colors w-full text-left"
          >
            <IconTarget className="flex items-center"><Logout01Icon size={16} /></IconTarget>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

const NavIcon = forwardRef<AnimatedIconHandle, { name: string }>(({ name }, ref) => {
  const size = 16;
  switch (name) {
    case "home": return <Home01Icon ref={ref} size={size} />;
    case "mail": return <Mail01Icon ref={ref} size={size} />;
    case "chart": return <SentIcon ref={ref} size={size} />;
    case "users": return <UserGroupIcon ref={ref} size={size} />;
    case "inbox": return <InboxIcon ref={ref} size={size} />;
    case "gear": return <Settings01Icon ref={ref} size={size} />;
    case "shield": return <Shield02Icon ref={ref} size={size} />;
  }
});
NavIcon.displayName = "NavIcon";

function NavLink({
  href,
  label,
  icon,
  isActive,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  badge?: string | number | null;
  onClick?: () => void;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  return (
    <Link
      href={href}
      onClick={() => {
        iconRef.current?.startAnimation();
        onClick?.();
      }}
      className={`flex items-center gap-3 px-6 py-2.5 text-sm relative transition-colors ${
        isActive ? "text-blue-accent" : "text-muted hover:text-blue-accent"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-accent rounded-r-sm" />
      )}
      <IconTarget triggerRef={iconRef} className="flex items-center">{icon}</IconTarget>
      {label}
      {badge && (
        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-accent text-white text-[10px] font-medium leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
