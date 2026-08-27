"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { CircleCheckIcon } from "@/components/icons/circle-check";

type Option = { value: string; label: string };

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  matchWidth,
  searchable,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  matchWidth?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setSearch("");
  }, [open, searchable]);

  const filtered = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={triggerClassName || "w-full flex items-center justify-between gap-2 bg-transparent border-b border-border pb-2 text-sm outline-none focus:border-ink text-left"}
      >
        <span className={`truncate ${selected ? "text-ink" : "text-muted"}`}>
          {selected ? selected.label : placeholder || "Select..."}
        </span>
        <ChevronDownIcon
          size={14}
          className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 ${matchWidth ? "w-full" : "min-w-[180px]"} bg-white border border-border rounded-lg shadow-lg overflow-hidden`}>
          {searchable && (
            <div className="px-3 py-2 border-b border-border">
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full text-sm outline-none bg-transparent placeholder:text-muted-2"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3.5 py-2.5 text-sm text-muted-2">No results</div>
            )}
            {filtered.map(o => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-4 shrink-0">
                    {isSelected && (
                      <CircleCheckIcon size={14} className="w-4 h-4 text-blue-accent" />
                    )}
                  </span>
                  <span className="text-sm text-ink">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
