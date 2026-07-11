"use client";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "default";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(15,13,20,0.4)", backdropFilter: "blur(4px)" }} onClick={onCancel}>
      <div className="bg-cream border border-border rounded-lg w-[90%] max-w-[380px] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn btn-ghost btn-sm">{cancelLabel || "Cancel"}</button>
          <button onClick={onConfirm} className={`btn btn-sm ${variant === "danger" ? "bg-red-600 hover:bg-red-700 text-white" : "btn-primary"}`}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
