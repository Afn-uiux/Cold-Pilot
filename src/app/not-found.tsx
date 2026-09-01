import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#F8FAFC",
      fontFamily: "'Geist', system-ui, sans-serif",
      padding: "40px clamp(20px,4vw,40px)",
      textAlign: "center",
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 72,
        fontWeight: 500,
        color: "#E4E2DC",
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}>404</span>
      <h1 style={{
        fontSize: "clamp(24px,3.5vw,32px)",
        fontWeight: 400,
        letterSpacing: "-0.02em",
        marginTop: 16,
        color: "#0F1929",
      }}>Page not found</h1>
      <p style={{ fontSize: 15, color: "#5A6B87", marginTop: 12, maxWidth: 400, lineHeight: 1.6 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 32,
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 500,
          color: "#fff",
          background: "#2563EB",
          borderRadius: 8,
          textDecoration: "none",
          transition: "opacity 0.15s",
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
