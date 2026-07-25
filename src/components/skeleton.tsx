"use client";

export function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{
            height: 14,
            borderRadius: 6,
            background: "linear-gradient(90deg, #f0eeeb 25%, #e8e5e0 50%, #f0eeeb 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton 1.5s ease-in-out infinite",
            width: i === 0 ? "60%" : i === 1 ? "80%" : "40%",
          }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 24,
          background: "var(--cream)",
        }}>
          <div style={{ height: 18, width: "50%", borderRadius: 6, background: "linear-gradient(90deg, #f0eeeb 25%, #e8e5e0 50%, #f0eeeb 75%)", backgroundSize: "200% 100%", animation: "skeleton 1.5s ease-in-out infinite", marginBottom: 12 }} />
          <div style={{ height: 13, width: "70%", borderRadius: 6, background: "linear-gradient(90deg, #f0eeeb 25%, #e8e5e0 50%, #f0eeeb 75%)", backgroundSize: "200% 100%", animation: "skeleton 1.5s ease-in-out infinite", marginBottom: 8 }} />
          <div style={{ height: 13, width: "40%", borderRadius: 6, background: "linear-gradient(90deg, #f0eeeb 25%, #e8e5e0 50%, #f0eeeb 75%)", backgroundSize: "200% 100%", animation: "skeleton 1.5s ease-in-out infinite" }} />
        </div>
      ))}
      <style>{`@keyframes skeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}
