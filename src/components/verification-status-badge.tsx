export default function VerificationStatusBadge({ status, verifying }: { status: string | null; verifying?: boolean }) {
  const pill = (cls: string, label: string) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );

  if (verifying) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-400">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        verifying
      </span>
    );
  }

  switch (status) {
    case "valid":
      return pill("bg-emerald-100 text-emerald-700", "valid");
    case "invalid":
      return pill("bg-red-100 text-red-700", "invalid / blocked");
    case "risky":
      return pill("bg-red-50 text-red-500", "risky / gated");
    case "catch_all":
      return pill("bg-orange-100 text-orange-700", "catch-all / review");
    case "unknown":
      return pill("bg-amber-100 text-amber-700", "unknown / flagged");
    default:
      return pill("bg-blue-50 text-blue-400", status || "unverified");
  }
}