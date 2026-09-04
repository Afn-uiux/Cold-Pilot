export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import ExportCsvButton, { SectionHead } from "@/app/admin/_components/export-csv-button";
import StatStrip from "@/app/admin/_components/stat-strip";

export default async function AdminDeliverabilityPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    bounceSplit,
    bounces7d,
    sent7d,
    suppressions,
    recentSuppressions,
    recentBounces,
    warmupSpam7d,
    warmupRescued7d,
    flaggedAccounts,
  ] = await Promise.all([
    prisma.bounceEvent.groupBy({
      by: ["bounceType"],
      _count: { _all: true },
      orderBy: { _count: { bounceType: "desc" } },
      take: 10,
    }),
    prisma.bounceEvent.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.emailLog.count({
      where: { type: "outgoing", status: "sent", sentAt: { gte: sevenDaysAgo } },
    }),
    prisma.suppression.count(),
    prisma.suppression.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        reason: true,
        type: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.bounceEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        domain: true,
        bounceType: true,
        errorCode: true,
        reason: true,
        createdAt: true,
        emailAccount: { select: { email: true } },
      },
    }),
    prisma.warmupLog.count({
      where: { foundInSpam: true, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.warmupLog.count({
      where: { rescuedFromSpam: true, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.emailAccount.findMany({
      where: { OR: [{ warmupBounceFlag: true }, { isPaused: true }] },
      take: 20,
      select: {
        id: true,
        email: true,
        healthState: true,
        healthScore: true,
        warmupBounceRate: true,
        warmupBounceFlag: true,
        isPaused: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0">
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
          Deliverability
        </h1>
        <p className="text-sm text-muted mt-1.5">Bounces, suppressions, spam placement and account health</p>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <StatStrip
          items={[
            {
              label: "Bounce rate · 7d",
              value: `${sent7d > 0 ? ((bounces7d / sent7d) * 100).toFixed(2) : "0.00"}%`,
              sub: `${bounces7d} bounces / ${sent7d} sent`,
            },
            { label: "Suppressions", value: String(suppressions), sub: "never-send list size" },
            { label: "Warmup in spam · 7d", value: String(warmupSpam7d), sub: `${warmupRescued7d} rescued` },
            { label: "Accounts needing attention", value: String(flaggedAccounts.length), sub: "paused or bounce-flagged" },
          ]}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="card">
            <SectionHead title="Bounces by type">
              <ExportCsvButton
                filename="bounces-by-type.csv"
                rows={bounceSplit.map((row) => ({ type: row.bounceType, count: String(row._count._all) }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {bounceSplit.length === 0 && (
                    <tr><td colSpan={2} className="text-muted">No bounces recorded</td></tr>
                  )}
                  {bounceSplit.map((row) => (
                    <tr key={row.bounceType}>
                      <td className="font-medium">{row.bounceType}</td>
                      <td>{row._count._all}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <SectionHead title="Recent suppressions">
              <ExportCsvButton
                filename="recent-suppressions.csv"
                rows={recentSuppressions.map((s) => ({
                  email: s.email,
                  reason: s.reason,
                  type: s.type,
                  user: s.user.email,
                  when: s.createdAt.toLocaleString(),
                }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Reason</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSuppressions.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">Suppression list is empty</td></tr>
                  )}
                  {recentSuppressions.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.email}</td>
                      <td className="text-muted">{s.reason} · {s.type}</td>
                      <td className="text-muted">{s.user.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Recent bounces">
            <ExportCsvButton
              filename="recent-bounces.csv"
              rows={recentBounces.map((b) => ({
                email: b.email,
                domain: b.domain,
                type: b.bounceType,
                detail: b.errorCode ?? b.reason ?? "",
                via: b.emailAccount?.email ?? "",
                when: b.createdAt.toLocaleString(),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Detail</th>
                  <th>Via account</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentBounces.length === 0 && (
                  <tr><td colSpan={6} className="text-muted">No bounces recorded</td></tr>
                )}
                {recentBounces.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.email}</td>
                    <td>{b.domain}</td>
                    <td>
                      <span className={`badge ${b.bounceType === "hard" ? "bg-red-50 text-red-700 border border-red-200" : "draft"}`}>
                        {b.bounceType}
                      </span>
                    </td>
                    <td className="text-muted">{b.errorCode ?? b.reason ?? "—"}</td>
                    <td className="text-muted">{b.emailAccount?.email ?? "—"}</td>
                    <td className="text-muted">{b.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Accounts needing attention">
            <ExportCsvButton
              filename="accounts-needing-attention.csv"
              rows={flaggedAccounts.map((a) => ({
                account: a.email,
                owner: a.user.email,
                health: a.healthState,
                score: String(Math.round(a.healthScore)),
                bounceRate: `${(a.warmupBounceRate * 100).toFixed(1)}%`,
                flags: [a.isPaused && "paused", a.warmupBounceFlag && "bounce-flag"].filter(Boolean).join(" · "),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Owner</th>
                  <th>Health</th>
                  <th>Score</th>
                  <th>Bounce rate</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {flaggedAccounts.length === 0 && (
                  <tr><td colSpan={6} className="text-muted">All accounts healthy</td></tr>
                )}
                {flaggedAccounts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.email}</td>
                    <td className="text-muted">{a.user.email}</td>
                    <td>{a.healthState}</td>
                    <td>{Math.round(a.healthScore)}</td>
                    <td>{(a.warmupBounceRate * 100).toFixed(1)}%</td>
                    <td className="text-muted">
                      {[a.isPaused && "paused", a.warmupBounceFlag && "bounce-flag"].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
