"use client";

import Link from "next/link";
import { forwardRef, useRef } from "react";
import { usePathname } from "next/navigation";
import Logo from "@/components/logo";
import { Home01Icon } from "@/components/icons/home-01";
import { UserGroupIcon } from "@/components/icons/user-group";
import { InboxIcon } from "@/components/icons/inbox";
import { ArrowLeft02Icon } from "@/components/icons/arrow-left-02";
import { IconTarget } from "@/components/icon-target";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";

const LINKS = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/seeds", label: "Seeds", icon: "inbox" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-50"
      style={{ width: 200, background: "var(--color-cream)", borderRight: "1px solid var(--color-border)", padding: "28px 0" }}
    >
      <div className="font-medium text-lg tracking-tight px-6 mb-9">
        <Link href="/admin" className="flex items-center"><Logo height={18} /></Link>
        <span className="text-[10px] tracking-widest uppercase text-muted-2 ml-2">Admin</span>
      </div>

      <div className="font-medium text-[10px] tracking-widest uppercase text-muted-2 px-6 pb-2">Menu</div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {LINKS.map((link) => {
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
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  return (
    <Link
      href={href}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      className={`flex items-center gap-3 px-6 py-2.5 text-sm relative transition-colors ${
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
    default: return null;
  }
});
NavIcon.displayName = "NavIcon";
