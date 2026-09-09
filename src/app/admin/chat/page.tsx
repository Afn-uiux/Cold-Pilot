"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Message01Icon } from "@/components/icons/message-01";

interface Conversation {
  userId: string;
  email: string;
  name: string | null;
  plan: string | null;
  deletedAt: string | null;
  count: number;
  lastMessage: string;
  lastRole: string;
  lastByAdmin: boolean;
  lastAt: string;
}

interface ChatMsg {
  id: string;
  role: string;
  byAdmin: boolean;
  content: string;
  createdAt: string;
}

export default function AdminChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  const [togglingAI, setTogglingAI] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/chat");
      const data = await res.json();
      if (active) {
        setConversations(data.conversations || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function openThread(userId: string) {
    setSelected(userId);
    setThreadLoading(true);
    setMessages([]);
    const res = await fetch(`/api/admin/chat?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setAiDisabled(data.aiDisabled ?? false);
    setThreadLoading(false);
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [messages, threadLoading]);

  async function sendReply() {
    const text = input.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected, content: text }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((m) => [...m, data.message]);
        setInput("");
        setConversations((list) =>
          list.map((c) =>
            c.userId === selected
              ? { ...c, count: c.count + 1, lastMessage: data.message.content, lastRole: "assistant", lastByAdmin: true, lastAt: new Date(data.message.createdAt).toISOString() }
              : c
          )
        );
      }
    } finally {
      setSending(false);
    }
  }

  const active = conversations.find((c) => c.userId === selected) ?? null;

  async function toggleAI() {
    if (!selected || togglingAI) return;
    setTogglingAI(true);
    try {
      const next = !aiDisabled;
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected, aiDisabled: next }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* non-JSON */ }
      if (data.ok) {
        setAiDisabled(next);
      } else {
        console.error("[admin-chat] toggle failed:", res.status, text);
      }
    } catch (e) {
      console.error("[admin-chat] toggle error:", e);
    } finally {
      setTogglingAI(false);
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
            Support chat
          </h1>
          <p className="text-sm text-muted mt-1.5">
            {loading ? "Loading..." : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16 flex flex-col lg:flex-row gap-5 items-start">
        <div
          className="w-full lg:w-[340px] shrink-0 rounded-2xl overflow-hidden border"
          style={{ borderColor: "var(--color-border)", background: "#fff" }}
        >
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-2">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-2">No support chats yet</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {conversations.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => openThread(c.userId)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors",
                    selected === c.userId && "bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {c.name || c.email}
                      {c.deletedAt ? <span className="text-muted-2 font-normal"> · deleted</span> : null}
                    </span>
                    <span className="text-[11px] text-muted-2 whitespace-nowrap">
                      {new Date(c.lastAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted truncate mt-0.5">
                    {c.lastRole === "assistant" ? (c.lastByAdmin ? "Shola: " : "Ava: ") : "User: "}
                    {c.lastMessage}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="badge draft">{c.plan || "free"}</span>
                    <span className="text-[11px] text-muted-2">{c.count} messages</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex-1 min-w-0 w-full rounded-2xl overflow-hidden border flex flex-col"
          style={{ borderColor: "var(--color-border)", background: "#fff" }}
        >
          {!active ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center px-6">
              <Message01Icon size={28} className="text-muted-2" />
              <p className="text-sm text-muted-2">Select a conversation to read it and reply.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
                <div>
                  <p className="text-sm font-medium">{active.name || active.email}</p>
                  <p className="text-[11px] text-muted-2">{active.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAI}
                    disabled={togglingAI}
                    className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50"
                    style={{ background: aiDisabled ? "#d1d5db" : "#22c55e" }}
                    aria-label={aiDisabled ? "Enable AI" : "Disable AI"}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                        aiDisabled ? "translate-x-0" : "translate-x-4"
                      )}
                    />
                  </button>
                  <span className="text-[11px] text-muted-2 whitespace-nowrap">
                    {aiDisabled ? "AI off" : "AI on"}
                  </span>
                  <a
                    href={`/admin/users/${active.userId}`}
                    className="btn btn-ghost btn-xs"
                  >
                    View user
                  </a>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 min-h-[360px] max-h-[460px] overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
                {threadLoading ? (
                  <p className="text-center text-sm text-muted-2 py-10">Loading thread...</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-2 py-10">Thread is empty.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                          m.role === "user"
                            ? "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                            : "bg-blue-600 text-white rounded-br-sm"
                        )}
                      >
                        {m.content}
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-2">
                          <span>{new Date(m.createdAt).toLocaleString()}</span>
                          {m.role === "assistant" && (
                            <span className={cn("px-1.5 py-px rounded-full", m.byAdmin ? "bg-green-50 text-green-700" : "bg-slate-100 text-muted")}>
                              {m.byAdmin ? "Shola" : "Ava"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendReply();
                }}
                className="flex items-center gap-2 border-t px-3 py-2.5 bg-white"
                style={{ borderColor: "var(--color-border)" }}
              >
                {aiDisabled && (
                  <span className="text-[11px] text-amber-600 whitespace-nowrap shrink-0">AI off — you&apos;re replying as Shola</span>
                )}
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={aiDisabled ? "Reply manually…" : "Reply as support…"}
                  disabled={sending}
                  className="flex-1 text-sm outline-none placeholder:text-muted-2 disabled:opacity-60"
                />
                <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary btn-xs">
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}