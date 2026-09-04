export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import ExportCsvButton, { SectionHead } from "@/app/admin/_components/export-csv-button";
import StatStrip from "@/app/admin/_components/stat-strip";

function StatusBadge({ status }: { status: string | null }) {
  if (status === "valid") return <span className="badge active">valid</span>;
  if (status === "invalid")
    return (
      <span className="badge bg-red-50 text-red-700 border border-red-200">
        invalid
      </span>
    );
  if (status === "risky") return <span className="badge active">risky</span>;
  if (status === "unknown") return <span className="badge draft">unknown</span>;
  return <span className="badge draft">unverified</span>;
}

export default async function AdminVerificationPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [statusSplit, providerSplit, reasonSplit, totalLeads, verified7d, recent, intelBySource, intelTotal, intelRecent] =
    await Promise.all([
      prisma.lead.groupBy({
        by: ["verificationStatus"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["provider"],
        where: { deletedAt: null, provider: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { provider: "desc" } },
        take: 10,
      }),
      prisma.lead.groupBy({
        by: ["verificationReason"],
        where: { deletedAt: null, verificationReason: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { verificationReason: "desc" } },
        take: 12,
      }),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.lead.count({
        where: { deletedAt: null, verifiedAt: { gte: sevenDaysAgo } },
      }),
      prisma.lead.findMany({
        where: { deletedAt: null, verifiedAt: { not: null } },
        orderBy: { verifiedAt: "desc" },
        take: 20,
        select: {
          id: true,
          email: true,
          verificationStatus: true,
          verificationReason: true,
          provider: true,
          verifiedAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.globalLeadIntel.groupBy({
        by: ["source"],
        where: { expiresAt: { gt: new Date() } },
        _count: { _all: true },
      }),
      prisma.globalLeadIntel.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.globalLeadIntel.findMany({
        where: { expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
        select: { id: true, email: true, reason: true, source: true, hitCount: true, lastSeenAt: true },
      }),
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusSplit) byStatus[row.verificationStatus ?? "unverified"] = row._count._all;
  const verified = (byStatus.valid ?? 0) + (byStatus.invalid ?? 0) + (byStatus.risky ?? 0) + (byStatus.unknown ?? 0);
  const unverified = byStatus.unverified ?? 0;

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0">
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
          Verification
        </h1>
        <p className="text-sm text-muted mt-1.5">Lead verification outcomes across the platform</p>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <StatStrip
          items={[
            { label: "Valid", value: String(byStatus.valid ?? 0), sub: "mailbox confirmed" },
            { label: "Invalid", value: String(byStatus.invalid ?? 0), sub: "bad addresses blocked" },
            { label: "Risky", value: String(byStatus.risky ?? 0), sub: "catch-all / disposable / role" },
            { label: "Unknown", value: String(byStatus.unknown ?? 0), sub: "greylisted / unreachable" },
            {
              label: "Unverified",
              value: String(unverified),
              sub: `${totalLeads > 0 ? Math.round((verified / totalLeads) * 100) : 0}% coverage · ${verified7d} in 7d`,
            },
          ]}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="card">
            <SectionHead title="Top providers">
              <ExportCsvButton
                filename="verification-by-provider.csv"
                rows={providerSplit.map((row) => ({
                  provider: row.provider ?? "unknown",
                  leads: String(row._count._all),
                }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {providerSplit.length === 0 && (
                    <tr><td colSpan={2} className="text-muted">No verified leads yet</td></tr>
                  )}
                  {providerSplit.map((row) => (
                    <tr key={row.provider}>
                      <td className="font-medium">{row.provider}</td>
                      <td>{row._count._all}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <SectionHead title="Top failure reasons">
              <ExportCsvButton
                filename="verification-failure-reasons.csv"
                rows={reasonSplit.map((row) => ({
                  reason: row.verificationReason ?? "unknown",
                  leads: String(row._count._all),
                }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reason</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {reasonSplit.length === 0 && (
                    <tr><td colSpan={2} className="text-muted">Reasons are recorded from the next deploy onward</td></tr>
                  )}
                  {reasonSplit.map((row) => (
                    <tr key={row.verificationReason}>
                      <td className="font-medium">{row.verificationReason}</td>
                      <td>{row._count._all}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Recently verified">
            <ExportCsvButton
              filename="recently-verified.csv"
              rows={recent.map((l) => ({
                email: l.email,
                status: l.verificationStatus ?? "unverified",
                reason: l.verificationReason ?? "",
                provider: l.provider ?? "",
                user: l.user.email,
                verified: l.verifiedAt?.toLocaleString() ?? "",
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Provider</th>
                  <th>User</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="text-muted">No verifications yet</td></tr>
                )}
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.email}</td>
                    <td><StatusBadge status={l.verificationStatus} /></td>
                    <td className="text-muted">{l.verificationReason ?? "—"}</td>
                    <td>{l.provider ?? "—"}</td>
                    <td className="text-muted">{l.user.email}</td>
                    <td className="text-muted">{l.verifiedAt?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Shared blocklist">
            <ExportCsvButton
              filename="shared-blocklist.csv"
              rows={intelRecent.map((e) => ({
                email: e.email,
                reason: e.reason,
                source: e.source,
                hits: String(e.hitCount),
                lastSeen: e.lastSeenAt.toLocaleString(),
              }))}
            />
          </SectionHead>
          <p className="text-sm text-muted font-normal -mt-2 mb-4">
            {intelTotal} addresses proven dead platform-wide — instantly blocked for every user. Definitive verdicts only.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Hits</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {intelRecent.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">Registry is empty — entries appear once verifications and bounces flow</td></tr>
                )}
                {intelRecent.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium">{e.email}</td>
                    <td className="text-muted">{e.reason.replaceAll("_", " ")}</td>
                    <td className="text-muted">{e.source}</td>
                    <td>{e.hitCount}</td>
                    <td className="text-muted">{e.lastSeenAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {intelBySource.length > 0 && (
            <p className="text-sm text-muted mt-3">
              {intelBySource.map((r) => `${r.source}: ${r._count._all}`).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
