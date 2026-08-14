"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/icons/chevron-down";

export default function CreditBadge() {
  const [balance, setBalance] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    function fetchState() {
      fetch("/api/user")
        .then(r => r.json())
        .then(data => {
          if (!active) return;
          if (typeof data.creditBalance === "number") setBalance(data.creditBalance);
          if (typeof data.plan === "string") setPlan(data.plan);
        })
        .catch(() => {});
    }
    fetchState();
    const interval = setInterval(fetchState, 60000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (balance === null) return null;

  const isFree = plan === "free" || plan === null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-white shadow-sm hover:border-blue-accent transition-colors cursor-pointer"
        title="Credits balance"
      >
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-[inset_0_-2px_0_#d38d15,0_1px_3px_rgba(0,0,0,0.15)]"
          style={{ background: "radial-gradient(circle at 30% 30%, #fceb6b, #fbc02d)" }}
        >
          <span style={{ fontSize: 10, color: "#fff", lineHeight: 1 }}>⚡</span>
        </span>
        <span className="text-sm font-bold text-ink tabular-nums">{Math.floor(balance).toLocaleString()}</span>
        <ChevronDownIcon
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "#4a4a4a", opacity: 0.8 }}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-lg shadow-lg z-50 py-1.5">
          <Link
            href="/dashboard/settings?tab=Billing"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink hover:bg-cream transition-colors"
          >
            Get more credits
          </Link>
          <Link
            href="/dashboard/settings?tab=Billing"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink hover:bg-cream transition-colors"
          >
            Upgrade
          </Link>
        </div>
      )}

      {isFree && (
        <Link
          href="/dashboard/settings?tab=Billing"
          className="ml-2 inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-blue-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Get All Features
        </Link>
      )}
    </div>
  );
}
