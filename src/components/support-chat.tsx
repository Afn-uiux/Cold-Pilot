"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Message01Icon } from "@/components/icons/message-01";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  byAdmin?: boolean;
}

const SUGGESTIONS = [
  "How does warmup work?",
  "What can I do on the free plan?",
  "How do I connect an inbox?",
  "What costs credits?",
];

export default function SupportChat() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // History is stored server-side (so support can review it) — load it fresh
  // so any admin replies show up here too.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/support-chat");
        const data = await res.json();
        if (active && Array.isArray(data.messages)) {
          const raw = data.messages as Array<{ role?: unknown; content?: unknown; byAdmin?: unknown }>;
          setMessages(
            raw
              .filter(
                (m): m is ChatMessage =>
                  !!m &&
                  (m.role === "user" || m.role === "assistant") &&
                  typeof m.content === "string"
              )
              .map((m) => ({ role: m.role, content: m.content, byAdmin: !!m.byAdmin }))
          );
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(scrollToBottom, [messages, loading, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (messages.length === 0) {
            setMessages([
              {
                role: "assistant",
                content:
                  "Hi there! I'm Ava, your Coldpilot assistant. Ask me anything — plans, credits, warmup, campaigns, connecting inboxes, whatever you need. How can I help?",
              },
            ]);
          }
        }}
        aria-label="Open support chat"
        className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/25 hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        <Message01Icon size={24} className="text-white" />
      </button>
    );
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || "Sorry, I hit a snag. Try again in a moment — or reach us at hello@usecoldpilot.com.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection issue — please try again in a few seconds." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-24 right-6 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
              <Message01Icon size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">Ava · Coldpilot Support</p>
              <p className="text-[11px] text-blue-100 leading-tight">Usually replies instantly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="text-blue-100 hover:text-white transition-colors p-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="h-80 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
<div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                  )}
                >
                  {m.content}
                  {m.byAdmin && (
                    <span className="block mt-1 text-[10px] text-muted-2">Shola</span>
                  )}
                </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 pt-1 flex flex-wrap gap-1.5 bg-slate-50">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={loading}
                className="text-xs border border-slate-200 rounded-full px-2.5 py-1 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-slate-200 px-3 py-2.5 bg-white"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            disabled={loading}
            className="flex-1 text-sm outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="h-9 w-9 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}