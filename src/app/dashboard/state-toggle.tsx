"use client";

import { useState } from "react";

export default function StateToggle() {
  const [state, setState] = useState<"normal" | "empty" | "loading" | "error">("normal");

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-cream z-50" style={{ padding: "8px 24px", display: "none" }}>
      <div className="font-medium text-[9px] tracking-widest uppercase text-muted-2 mb-1">UI State</div>
      <div className="flex gap-1.5">
        {(["normal", "empty", "loading", "error"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`text-[11px] px-2 py-1 rounded transition-all ${
              state === s ? "bg-ink text-white" : "bg-cream-2 text-muted border border-border"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
