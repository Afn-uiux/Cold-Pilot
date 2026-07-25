"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Toast = { id: number; message: string; type: "success" | "error" | "info" };

const ToastContext = createContext<{ toast: (message: string, type?: Toast["type"]) => void }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              pointerEvents: "auto",
              padding: "12px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'Geist', system-ui, sans-serif",
              color: "#fff",
              background: t.type === "error" ? "#C62828" : t.type === "success" ? "#2E7D32" : "#0F1929",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              cursor: "pointer",
              animation: "toastIn 0.25s ease-out",
              maxWidth: 380,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastContext.Provider>
  );
}
