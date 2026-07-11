"use client";

import { useState, useRef, useEffect } from "react";

type Account = { id: string; email: string; provider: string; status: string };

export default function AccountDropdown({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
  }

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id];
    onChange(next);
  }

  const label = selected.length === 0
    ? "Select..."
    : `${selected.length} of ${accounts.length} selected`;

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border border-border rounded-lg px-3.5 py-2.5 text-sm bg-cream hover:bg-cream-2 transition-colors text-left"
      >
        <span className={selected.length === 0 ? "text-muted" : "text-ink"}>
          {label}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {accounts.map(a => {
              const isSelected = selected.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-4 shrink-0">
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-blue-accent">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <span className="text-sm text-ink truncate">{a.email}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${a.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.status === "active" ? "Active" : "Account not active"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
