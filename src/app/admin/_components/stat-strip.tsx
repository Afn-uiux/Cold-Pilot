export interface StripItem {
  label: string;
  value: string;
  sub?: string;
}

// Compact stat strip for admin detail pages: the same bordered-cell family
// as the big Overview .metrics cards, at half height, so the summary reads
// as one connected bar and tables start immediately. Big cards stay on
// Overview only.
export default function StatStrip({ items }: { items: StripItem[] }) {
  return (
    <div className="metrics compact">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <div className="metric-label">{item.label}</div>
          <div className="metric-value">{item.value}</div>
          {item.sub && <div className="metric-change text-muted">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
