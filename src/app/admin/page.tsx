export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import BackupSection from "./_components/backup-section";

export default async function AdminDashboardPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers7d,
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    totalEmailsSent,
    totalWarmupEmails,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.campaign.count({ where: { deletedAt: null } }),
    prisma.campaign.count({ where: { status: "active", deletedAt: null } }),
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.emailLog.count(),
    prisma.warmupLog.count({ where: { status: "sent" } }),
  ]);

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { campaigns: true, leads: true, emailAccounts: true } },
    },
  });

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0">
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
          Overview
        </h1>
        <p className="text-sm text-muted mt-1.5">Platform stats and recent signups</p>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Total Users</div>
            <div className="metric-value">{totalUsers}</div>
            <div className="metric-change text-muted">{activeUsers7d} active this week</div>
          </div>
          <div className="metric">
            <div className="metric-label">Campaigns</div>
            <div className="metric-value">{totalCampaigns}</div>
            <div className="metric-change text-muted">{activeCampaigns} active</div>
          </div>
          <div className="metric">
            <div className="metric-label">Total Leads</div>
            <div className="metric-value">{totalLeads}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Emails Sent</div>
            <div className="metric-value">{totalEmailsSent}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Warmup Emails</div>
            <div className="metric-value">{totalWarmupEmails}</div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-medium text-[clamp(20px,2.5vw,24px)] tracking-tight mb-4">Recent Signups</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Campaigns</th>
                  <th>Leads</th>
                  <th>Accounts</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name || "—"}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === "admin" ? "active" : "draft"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u._count.campaigns}</td>
                    <td>{u._count.leads}</td>
                    <td>{u._count.emailAccounts}</td>
                    <td className="text-muted">{u.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <BackupSection />
      </div>
    </div>
  );
}
