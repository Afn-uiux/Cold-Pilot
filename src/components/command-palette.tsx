"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Command = { label: string; shortcut?: string; action: () => void; section: string };

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { label: "Dashboard", shortcut: "G D", action: () => router.push("/dashboard"), section: "Go to" },
    { label: "Leads", shortcut: "G L", action: () => router.push("/dashboard/leads"), section: "Go to" },
    { label: "Campaigns", shortcut: "G C", action: () => router.push("/dashboard/campaigns"), section: "Go to" },
    { label: "Templates", shortcut: "G T", action: () => router.push("/dashboard/templates"), section: "Go to" },
    { label: "Email Accounts", shortcut: "G E", action: () => router.push("/dashboard/email-accounts"), section: "Go to" },
    { label: "Inbox", action: () => router.push("/dashboard/inbox"), section: "Go to" },
    { label: "Analytics", action: () => router.push("/dashboard/analytics"), section: "Go to" },
    { label: "Settings", action: () => router.push("/dashboard/settings"), section: "Go to" },
    { label: "New Campaign", action: () => router.push("/dashboard/campaigns/new"), section: "Actions" },
    { label: "Import Leads", action: () => router.push("/dashboard/leads"), section: "Actions" },
    { label: "Connect Email Account", action: () => router.push("/dashboard/email-accounts"), section: "Actions" },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) { filtered[selected].action(); setOpen(false); }
  }

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh", background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }}
      onClick={() => setOpen(false)}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid rgba(15,25,41,0.08)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9BB5" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "'Geist', system-ui, sans-serif", color: "#0F1929", background: "transparent" }} />
          <kbd style={{ fontSize: 11, color: "#8A9BB5", border: "1px solid rgba(15,25,41,0.12)", borderRadius: 4, padding: "2px 6px", fontFamily: "'JetBrains Mono', monospace" }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", padding: "8px" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "#8A9BB5" }}>No commands found</div>
          )}
          {(() => {
            const sections: Record<string, Command[]> = {};
            filtered.forEach(c => { (sections[c.section] = sections[c.section] || []).push(c); });
            return Object.entries(sections).map(([section, cmds]) => (
              <div key={section}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#8A9BB5", padding: "8px 12px 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{section}</div>
                {cmds.map(cmd => {
                  const idx = filtered.indexOf(cmd);
                  return (
                    <button key={cmd.label} onClick={() => { cmd.action(); setOpen(false); }}
                      onMouseEnter={() => setSelected(idx)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: "'Geist', system-ui, sans-serif",
                        color: "#0F1929", background: idx === selected ? "rgba(15,25,41,0.04)" : "transparent",
                        border: "none", borderRadius: 6, cursor: "pointer", textAlign: "left",
                      }}>
                      <span>{cmd.label}</span>
                      {cmd.shortcut && (
                        <span style={{ fontSize: 11, color: "#8A9BB5", fontFamily: "'JetBrains Mono', monospace" }}>{cmd.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
