"use client";

import { useState, useEffect } from "react";

export default function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const ranges = ["7d", "30d", "90d", "All"];
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchStats() {
    setLoading(true);
    setError(null);
    fetch(`/api/stats?range=${range}`)
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || `Failed to load analytics (${r.status})`);
        return data;
      })
      .then(data => setStats(data))
      .catch(err => { setStats(null); setError(err.message || "Failed to load analytics"); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const d = stats?.detailed || {};
  const s = stats?.summary || {};

  const sent = d.sent || 0;
  const delivered = d.delivered || 0;
  const opened = d.totalOpens || 0;
  const clicked = d.totalClicks || 0;
  const replied = d.totalReplies || 0;
  const bounced = d.bounced || 0;
  const openRate = s.openRate || 0;
  const clickRate = s.clickRate || 0;
  const replyRate = s.replyRate || 0;
  const bounceRate = s.bounceRate || 0;

  const stepAnalytics: any[] = stats?.stepAnalytics || [];
  const activity: { date: string; count: number }[] = stats?.activity || [];

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Analytics</h1>
          <p className="text-sm text-muted mt-1.5">Campaign performance overview</p>
        </div>
        <div className="flex gap-1 bg-cream border border-border rounded-lg p-0.5">
          {ranges.map(r => (
            <button key={r} onClick={() => { setLoading(true); setRange(r); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${range === r ? "bg-ink text-white" : "text-muted hover:text-blue-accent"}`}>
              {r}
            </button>
          ))}
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16 space-y-8">
        {loading ? (
          <div className="text-center text-muted py-16 text-sm">Loading...</div>
        ) : error ? (
          <div className="empty-state">
            <h3>Couldn't load analytics</h3>
            <p>{error}</p>
            <button onClick={fetchStats} className="btn btn-primary btn-sm mt-2">
              Retry
            </button>
          </div>
        ) : sent === 0 ? (
          <div className="empty-state">
            <h3>No data yet</h3>
            <p>Analytics will appear once you start sending campaigns.</p>
          </div>
        ) : (
          <>
            <div className="metrics">
              {[
                ["Sent", sent],
                ["Delivered", delivered],
                ["Opened", opened],
                ["Clicked", clicked],
                ["Replied", replied],
                ["Bounced", bounced],
              ].map(([label, val]) => (
                <div key={label as string} className="metric">
                  <div className="metric-label">{label}</div>
                  <div className="metric-value !text-[28px]">{(val as number).toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="card">
                <div className="flex justify-between text-sm mb-1.5"><span>Open Rate</span><strong>{openRate}%</strong></div>
                <div className="placement-bar !m-0"><div className="placement-inbox" style={{ width: `${Math.min(openRate, 100)}%` }} /></div>
                <span className="text-[11px] text-muted-2 mt-1 block">{opened} opens of {delivered} delivered</span>
              </div>
              <div className="card">
                <div className="flex justify-between text-sm mb-1.5"><span>Click Rate</span><strong>{clickRate}%</strong></div>
                <div className="placement-bar !m-0"><div className="placement-inbox" style={{ width: `${Math.min(clickRate, 100)}%`, background: "#7C3AED" }} /></div>
                <span className="text-[11px] text-muted-2 mt-1 block">{clicked} clicks</span>
              </div>
              <div className="card">
                <div className="flex justify-between text-sm mb-1.5"><span>Reply Rate</span><strong>{replyRate}%</strong></div>
                <div className="placement-bar !m-0"><div className="placement-inbox" style={{ width: `${Math.min(replyRate, 100)}%`, background: "#1565C0" }} /></div>
                <span className="text-[11px] text-muted-2 mt-1 block">{replied} replies</span>
              </div>
              <div className="card">
                <div className="flex justify-between text-sm mb-1.5"><span>Bounce Rate</span><strong>{bounceRate}%</strong></div>
                <div className="placement-bar !m-0"><div className="placement-inbox" style={{ width: `${Math.min(bounceRate, 100)}%`, background: "#DC2626" }} /></div>
                <span className="text-[11px] text-muted-2 mt-1 block">{bounced} bounces of {sent} sent</span>
              </div>
            </div>

            {activity.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-sm font-medium">Activity</h3>
                  <span className="text-xs text-muted">{activity.reduce((s, d) => s + d.count, 0)} emails over {activity.length} days</span>
                </div>
                <div className="h-48 flex items-end justify-between gap-1 px-2 pt-6 pb-4">
                  {activity.map((d) => {
                    const maxCount = Math.max(...activity.map(a => a.count), 1);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                        <div className="w-full bg-blue-accent/30 hover:bg-blue-accent/60 rounded-sm transition-colors" style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: 2 }} />
                        <span className="text-[9px] text-muted-2 truncate w-full text-center">{formatDay(d.date)}</span>
                        <div className="absolute bottom-8 hidden group-hover:block bg-ink text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">{d.count} sent on {d.date}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stepAnalytics.length > 0 && stepAnalytics.map((ca: any) => (
              <div key={ca.campaignId} className="card">
                <div className="card-header">
                  <h3 className="text-sm font-medium">{ca.campaignName}</h3>
                  <span className="text-xs text-muted-2">Step Analytics</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Sent</th>
                        <th>Open</th>
                        <th>Replied</th>
                        <th>Clicked</th>
                        <th>Opportunities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ca.steps.map((s: any) => (
                        <tr key={s.step}>
                          <td><span className="text-sm font-medium">Step {s.step}</span></td>
                          <td>{s.sent || "—"}</td>
                          <td>{s.opened} ({s.openedPct}%)</td>
                          <td>{s.replied} ({s.repliedPct}%)</td>
                          <td>{s.clicked} ({s.clickedPct}%)</td>
                          <td>{s.opportunities} ({s.opportunitiesPct}%)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {stepAnalytics.length === 0 && sent > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-sm font-medium">Step Analytics</h3>
                </div>
                <p className="text-sm text-muted py-4 text-center">No step data available.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
