import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignRow } from "@/components/campaign-row";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { _count: { select: { leads: true, steps: true } } },
  });

  const totalLeads = await prisma.lead.count({ where: { userId } });
  const emailLogs = await prisma.emailLog.findMany({
    where: { lead: { userId } },
    select: { status: true, openedAt: true, repliedAt: true },
  });

  const sent = emailLogs.length;
  const replied = emailLogs.filter(e => e.repliedAt).length;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0;

  return (
    <div>
      <header className="flex items-center justify-between px-6 lg:px-10 pt-8 pb-0 gap-5 flex-wrap">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Overview</h1>
          <p className="text-sm text-muted mt-1.5">Your outreach at a glance.</p>
        </div>
        <Link href="/dashboard/campaigns" className="btn btn-primary">New campaign</Link>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Campaigns</div>
            <div className="metric-value">{campaigns.length}</div>
            <div className="metric-change up">{campaigns.filter(c => c.status === "active").length} active</div>
          </div>
          <div className="metric">
            <div className="metric-label">Leads</div>
            <div className="metric-value">{totalLeads}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Sent</div>
            <div className="metric-value">{sent}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Replies</div>
            <div className="metric-value">{replied}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Reply Rate</div>
            <div className="metric-value">{replyRate}%</div>
          </div>
        </div>

        <div className="mt-9">
          <div className="section-head">
            <h2>Recent campaigns</h2>
            <Link href="/dashboard/campaigns" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="empty-state">
              <h3>No campaigns yet</h3>
              <p>Create your first campaign to start sending outreach.</p>
              <Link href="/dashboard/campaigns" className="btn btn-primary">Create campaign</Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Leads</th>
                    <th>Steps</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <CampaignRow key={c.id} id={c.id} name={c.name} leads={c._count.leads} steps={c._count.steps} status={c.status} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
