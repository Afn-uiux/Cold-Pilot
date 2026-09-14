import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignRow } from "@/components/campaign-row";
import CreditBadge from "@/components/credit-badge";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const totalCampaigns = await prisma.campaign.count({ where: { userId, deletedAt: null } });
  const activeCampaigns = await prisma.campaign.count({ where: { userId, deletedAt: null, status: "active" } });

  const campaigns = await prisma.campaign.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { _count: { select: { leads: true, steps: true } } },
  });

  const totalLeads = await prisma.lead.count({ where: { userId, campaignId: { not: null }, deletedAt: null } });
  const emailLogs = await prisma.emailLog.findMany({
    where: { lead: { userId, campaignId: { not: null }, deletedAt: null } },
    select: { status: true, openedAt: true },
  });
  // Counts unique leads who replied, not raw reply events — a lead who
  // replies more than once (e.g. once to a campaign step, again later in
  // the inbox) was previously counted once per reply, which is why
  // "Replies" could show a number higher than the total lead count.
  const replied = await prisma.lead.count({
    where: { userId, campaignId: { not: null }, deletedAt: null, status: "replied" },
  });

  const sent = emailLogs.filter(e => e.status === "sent" || e.status === "delivered").length;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0;

  return (
    <div>
      <header className="dash-header">
        <div>
          <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] font-normal tracking-tight leading-tight">Overview</h1>
          <p className="text-sm text-muted mt-1.5">Your outreach at a glance.</p>
        </div>
        <div className="dash-header-actions">
          <CreditBadge />
          <Link href="/dashboard/campaigns" className="btn btn-primary">New campaign</Link>
        </div>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Campaigns</div>
            <div className="metric-value">{totalCampaigns}</div>
            <div className="metric-change up">{activeCampaigns} active</div>
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
