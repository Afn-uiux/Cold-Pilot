"use client";

import Link from "next/link";
import { forwardRef, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Logo from "@/components/logo";
import { Home01Icon } from "@/components/icons/home-01";
import { UserGroupIcon } from "@/components/icons/user-group";
import { InboxIcon } from "@/components/icons/inbox";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { Shield02Icon } from "@/components/icons/shield-02";
import { AlertCircleIcon } from "@/components/icons/alert-circle";
import { SentIcon } from "@/components/icons/sent";
import { TrendUpIcon } from "@/components/icons/trend-up";
import { Mail01Icon } from "@/components/icons/mail-01";
import { Message01Icon } from "@/components/icons/message-01";
import { ArrowLeft02Icon } from "@/components/icons/arrow-left-02";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { IconTarget } from "@/components/icon-target";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";

type NavLink = { href: string; label: string; icon: string };

const MAIN_LINKS: NavLink[] = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/chat", label: "Chat", icon: "message" },
  { href: "/admin/credits", label: "Credits", icon: "trend" },
];

const GROUPS: { key: string; label: string; links: NavLink[] }[] = [
  {
    key: "campaigns",
    label: "Campaigns",
    links: [
      { href: "/admin/sending", label: "Sending", icon: "sent" },
      { href: "/admin/deliverability", label: "Deliverability", icon: "shield" },
      { href: "/admin/email-previews", label: "Templates", icon: "mail" },
      { href: "/admin/seeds", label: "Seeds", icon: "inbox" },
    ],
  },
  {
    key: "security",
    label: "Security",
    links: [
      { href: "/admin/verification", label: "Verification", icon: "verify" },
      { href: "/admin/login-attempts", label: "Login attempts", icon: "alert" },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) {
      init[g.key] = g.links.some(
        (l) => pathname === l.href || pathname.startsWith(l.href)
      );
    }
    return init;
  });

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-50"
      style={{ width: 200, background: "var(--color-cream)", borderRight: "1px solid var(--color-border)", padding: "28px 0" }}
    >
      <div className="font-medium text-lg tracking-tight px-6 mb-9">
        <Link href="/admin" className="flex items-center"><Logo height={18} /></Link>
        <span className="text-[10px] tracking-widest uppercase text-muted-2 ml-2">Admin</span>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {MAIN_LINKS.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
          return (
            <AdminNavLink
              key={link.href}
              href={link.href}
              label={link.label}
              icon={<NavIcon name={link.icon} />}
              isActive={isActive}
            />
          );
        })}

        {GROUPS.map((group) => {
          const isOpen = open[group.key];
          const hasActive = group.links.some(
            (l) => pathname === l.href || pathname.startsWith(l.href)
          );
          return (
            <div key={group.key} className="mt-1.5">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [group.key]: !o[group.key] }))}
                className={`flex items-center gap-3 w-full px-6 py-2 text-xs font-medium tracking-wide uppercase transition-colors ${
                  hasActive ? "text-blue-accent" : "text-muted-2 hover:text-blue-accent"
                }`}
              >
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDownIcon
                  size={12}
                  className={`transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {isOpen && (
                <div className="flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const isActive = pathname === link.href || pathname.startsWith(link.href);
                    return (
                      <AdminNavLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        icon={<NavIcon name={link.icon} />}
                        isActive={isActive}
                        nested
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="pt-3 border-t border-border px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 py-2.5 text-sm text-muted hover:text-blue-accent transition-colors"
        >
          <IconTarget className="flex items-center"><ArrowLeft02Icon size={16} /></IconTarget>
          Back to App
        </Link>
      </div>
    </aside>
  );
}

function AdminNavLink({
  href,
  label,
  icon,
  isActive,
  nested,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  nested?: boolean;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  return (
    <Link
      href={href}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      className={`flex items-center gap-3 ${nested ? "pl-10 pr-6" : "px-6"} py-2 text-sm relative transition-colors ${
        isActive ? "text-blue-accent" : "text-muted hover:text-blue-accent"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-accent rounded-r-sm" />
      )}
      <IconTarget triggerRef={iconRef} className="flex items-center">{icon}</IconTarget>
      {label}
    </Link>
  );
}

const NavIcon = forwardRef<AnimatedIconHandle, { name: string }>(({ name }, ref) => {
  switch (name) {
    case "home": return <Home01Icon ref={ref} size={16} />;
    case "users": return <UserGroupIcon ref={ref} size={16} />;
    case "inbox": return <InboxIcon ref={ref} size={16} />;
    case "verify": return <CircleCheckIcon ref={ref} size={16} />;
    case "shield": return <Shield02Icon ref={ref} size={16} />;
    case "sent": return <SentIcon ref={ref} size={16} />;
    case "trend": return <TrendUpIcon ref={ref} size={16} />;
    case "mail": return <Mail01Icon ref={ref} size={16} />;
    case "message": return <Message01Icon ref={ref} size={16} />;
    case "alert": return <AlertCircleIcon ref={ref} size={16} />;
    default: return null;
  }
});
NavIcon.displayName = "NavIcon";
