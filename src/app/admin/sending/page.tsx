export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import ExportCsvButton, { SectionHead } from "@/app/admin/_components/export-csv-button";
import StatStrip from "@/app/admin/_components/stat-strip";

interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

// Live BullMQ queue depths. Returns null when Redis isn't configured (jobs
// run inline) or unreachable — the page then says so instead of crashing.
async function getQueueCounts(): Promise<Record<string, QueueCounts> | null> {
  const url = process.env.REDIS_URL || "";
  if (!url) return null;
  try {
    const { Queue } = await import("bullmq");
    const out: Record<string, QueueCounts> = {};
    for (const name of ["warmup", "campaign", "replyCheck"]) {
      const q = new Queue(name, { connection: { url } });
      const counts = await q.getJobCounts("waiting", "active", "delayed", "failed");
      out[name] = {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      };
      await q.close();
    }
    return out;
  } catch {
    return null;
  }
}

export default async function AdminSendingPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [queues, activeCampaigns, recentFailures, sent7d, unhealthyAccounts] =
    await Promise.all([
      getQueueCounts(),
      prisma.campaign.findMany({
        where: { status: "active", deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          dailySendLimit: true,
          updatedAt: true,
          user: { select: { email: true } },
          _count: { select: { leads: true } },
        },
      }),
      prisma.emailLog.findMany({
        where: { error: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 15,
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          error: true,
          sentAt: true,
          lead: { select: { email: true } },
          emailAccount: { select: { email: true } },
        },
      }),
      prisma.emailLog.count({
        where: { type: "outgoing", status: "sent", sentAt: { gte: sevenDaysAgo } },
      }),
      prisma.emailAccount.findMany({
        where: { NOT: { healthState: "healthy" } },
        take: 20,
        select: {
          id: true,
          email: true,
          healthState: true,
          healthScore: true,
          isPaused: true,
          user: { select: { email: true } },
        },
      }),
    ]);

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0">
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
          Sending
        </h1>
        <p className="text-sm text-muted mt-1.5">Workers, queues, active campaigns and send failures</p>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <StatStrip
          items={[
            { label: "Sent · 7d", value: String(sent7d), sub: "outgoing emails" },
            { label: "Active campaigns", value: String(activeCampaigns.length), sub: "listed below" },
            { label: "Recent failures", value: String(recentFailures.length), sub: "latest 15 with errors" },
            { label: "Unhealthy accounts", value: String(unhealthyAccounts.length), sub: "health ≠ healthy" },
          ]}
        />

        <div className="mt-8 card">
          <SectionHead title="Worker queues">
            {queues !== null && (
              <ExportCsvButton
                filename="worker-queues.csv"
                rows={Object.entries(queues).map(([name, c]) => ({
                  queue: name,
                  waiting: String(c.waiting),
                  active: String(c.active),
                  delayed: String(c.delayed),
                  failed: String(c.failed),
                }))}
              />
            )}
          </SectionHead>
          {queues === null ? (
            <p className="text-sm text-muted">
              Queue backend not reachable — jobs are running inline (no Redis). Set REDIS_URL and run the
              workers process to use queued sending.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Queue</th>
                    <th>Waiting</th>
                    <th>Active</th>
                    <th>Delayed</th>
                    <th>Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(queues).map(([name, c]) => (
                    <tr key={name}>
                      <td className="font-medium">{name}</td>
                      <td>{c.waiting}</td>
                      <td>{c.active}</td>
                      <td>{c.delayed}</td>
                      <td>
                        {c.failed > 0 ? (
                          <span className="badge bg-red-50 text-red-700 border border-red-200">{c.failed}</span>
                        ) : (
                          0
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 card">
          <SectionHead title="Active campaigns">
            <ExportCsvButton
              filename="active-campaigns.csv"
              rows={activeCampaigns.map((c) => ({
                campaign: c.name,
                owner: c.user.email,
                leads: String(c._count.leads),
                dailyLimit: String(c.dailySendLimit),
                updated: c.updatedAt.toLocaleString(),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Owner</th>
                  <th>Leads</th>
                  <th>Daily limit</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {activeCampaigns.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">No active campaigns</td></tr>
                )}
                {activeCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-muted">{c.user.email}</td>
                    <td>{c._count.leads}</td>
                    <td>{c.dailySendLimit}/day</td>
                    <td className="text-muted">{c.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Recent send failures">
            <ExportCsvButton
              filename="send-failures.csv"
              rows={recentFailures.map((f) => ({
                to: f.lead.email,
                type: `${f.type} · ${f.status}`,
                via: f.emailAccount?.email ?? "",
                error: (f.error ?? "").slice(0, 300),
                when: f.sentAt.toLocaleString(),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>To</th>
                  <th>Type</th>
                  <th>Via</th>
                  <th>Error</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">No failures recorded</td></tr>
                )}
                {recentFailures.map((f) => (
                  <tr key={f.id}>
                    <td className="font-medium">{f.lead.email}</td>
                    <td className="text-muted">{f.type} · {f.status}</td>
                    <td className="text-muted">{f.emailAccount?.email ?? "—"}</td>
                    <td className="text-muted">{f.error?.slice(0, 120)}</td>
                    <td className="text-muted">{f.sentAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {unhealthyAccounts.length > 0 && (
          <div className="mt-8 card">
            <SectionHead title="Unhealthy sending accounts">
              <ExportCsvButton
                filename="unhealthy-accounts.csv"
                rows={unhealthyAccounts.map((a) => ({
                  account: a.email,
                  owner: a.user.email,
                  state: a.healthState,
                  score: String(Math.round(a.healthScore)),
                  paused: a.isPaused ? "yes" : "no",
                }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Owner</th>
                    <th>State</th>
                    <th>Score</th>
                    <th>Paused</th>
                  </tr>
                </thead>
                <tbody>
                  {unhealthyAccounts.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.email}</td>
                      <td className="text-muted">{a.user.email}</td>
                      <td>{a.healthState}</td>
                      <td>{Math.round(a.healthScore)}</td>
                      <td>{a.isPaused ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
