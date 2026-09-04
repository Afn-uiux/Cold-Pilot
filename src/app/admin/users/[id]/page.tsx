export const runtime = "nodejs";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UserDetailView, { type UserDetailData } from "./user-detail-view";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      plan: true,
      creditBalance: true,
      trialEndsAt: true,
      trialVoided: true,
      trialVoidReason: true,
      riskScore: true,
      riskFlags: true,
      riskStatus: true,
      signupIp: true,
      bachsCustomerId: true,
      bachsSubscriptionId: true,
      createdAt: true,
      deletedAt: true,
    },
  });
  if (!user) notFound();

  const [
    verifySplit,
    totalLeads,
    granted,
    spent,
    payments,
    transactions,
    campaigns,
    accounts,
    bounces,
    suppressions,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["verificationStatus"],
      where: { userId: id, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { userId: id, deletedAt: null } }),
    prisma.creditTransaction.aggregate({
      where: { userId: id, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { userId: id, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    prisma.paymentEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, amount: true, currency: true, plan: true, createdAt: true },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, amount: true, reason: true, createdAt: true },
    }),
    prisma.campaign.findMany({
      where: { userId: id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        _count: { select: { leads: true } },
      },
    }),
    prisma.emailAccount.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        provider: true,
        healthState: true,
        healthScore: true,
        isPaused: true,
        warmupEnabled: true,
      },
    }),
    prisma.bounceEvent.findMany({
      where: { lead: { userId: id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        bounceType: true,
        reason: true,
        errorCode: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            status: true,
            verificationStatus: true,
            campaign: { select: { name: true } },
          },
        },
      },
    }),
    prisma.suppression.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, reason: true, type: true, createdAt: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of verifySplit) byStatus[row.verificationStatus ?? "unverified"] = row._count._all;
  const paid = user.plan !== "free";

  const suppressedLeads = suppressions.length > 0
    ? await prisma.lead.findMany({
        where: { userId: id, deletedAt: null, email: { in: suppressions.map((s) => s.email) } },
        select: { email: true, status: true, verificationStatus: true, campaign: { select: { name: true } } },
      })
    : [];
  const leadByEmail: Record<string, (typeof suppressedLeads)[number]> = {};
  for (const l of suppressedLeads) leadByEmail[l.email.toLowerCase()] = l;

  const describeLead = (lead: { status: string; verificationStatus: string | null; campaign: { name: string } | null } | null) =>
    lead
      ? `${lead.campaign?.name ?? "no campaign"} · ${lead.status}${lead.verificationStatus ? ` · ${lead.verificationStatus}` : ""}`
      : "no linked lead";

  const data: UserDetailData = {
    displayName: user.name || user.email,
    email: user.email,
    plan: user.plan,
    role: user.role,
    deleted: !!user.deletedAt,
    metrics: [
      {
        label: "Risk",
        value: user.riskStatus,
        sub: `score ${user.riskScore}${user.trialVoided ? " · trial voided" : ""}${user.signupIp ? ` · ${user.signupIp}` : ""}`,
      },
      {
        label: "Credit balance",
        value: String(Math.round(user.creditBalance)),
        sub: `+${Math.round(granted._sum.amount ?? 0)} / ${Math.round(spent._sum.amount ?? 0)} lifetime`,
      },
      {
        label: "Leads",
        value: String(totalLeads),
        sub: `${byStatus.valid ?? 0} valid · ${byStatus.invalid ?? 0} invalid · ${byStatus.risky ?? 0} risky · ${byStatus.unknown ?? 0} unknown`,
      },
      {
        label: "Campaigns",
        value: String(campaigns.length),
        sub: "showing up to 10",
      },
      {
        label: "Accounts",
        value: String(accounts.length),
        sub: `${accounts.filter((a) => a.isPaused).length} paused · ${accounts.filter((a) => a.healthState !== "healthy").length} unhealthy`,
      },
    ],
    payments: payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: p.amount,
      currency: p.currency,
      plan: p.plan,
      when: p.createdAt.toLocaleString(),
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: `${t.amount < 0 ? "" : "+"}${Math.round(t.amount)}`,
      reason: t.reason,
      when: t.createdAt.toLocaleString(),
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leads: String(c._count.leads),
      updated: c.updatedAt.toLocaleString(),
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      email: a.email,
      provider: a.provider,
      health: `${a.healthState} · ${Math.round(a.healthScore)}`,
      flags: [a.isPaused && "paused", a.warmupEnabled && "warmup"].filter(Boolean).join(" · ") || "—",
    })),
    bounces: bounces.map((b) => ({
      id: b.id,
      email: b.email,
      type: b.bounceType,
      lead: describeLead(b.lead),
      detail: b.errorCode ?? b.reason ?? "—",
      when: b.createdAt.toLocaleString(),
    })),
    suppressions: suppressions.map((s) => {
      const matched = leadByEmail[s.email.toLowerCase()];
      return {
        id: s.id,
        email: s.email,
        reason: `${s.reason} · ${s.type}`,
        lead: matched ? describeLead(matched) : "no matching lead",
        when: s.createdAt.toLocaleDateString(),
      };
    }),
    facts: [
      { label: "Joined", value: user.createdAt.toLocaleString() },
      {
        label: "Trial ends",
        value: `${user.trialEndsAt?.toLocaleString() ?? "—"}${user.trialVoided ? ` (voided: ${user.trialVoidReason ?? "no reason"})` : ""}`,
      },
      { label: "Subscription", value: user.bachsSubscriptionId ?? "—" },
      { label: "Bachs customer", value: user.bachsCustomerId ?? "—" },
      { label: "Risk flags", value: user.riskFlags },
    ],
  };

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0">
        <Link href="/admin/users" className="text-sm text-muted hover:text-blue-accent transition-colors">
          ← All users
        </Link>
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight mt-2">
          {data.displayName}
        </h1>
        <p className="text-sm text-muted mt-1.5 flex items-center gap-2 flex-wrap">
          {data.email}
          {paid ? (
            <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">
              {data.plan}
            </span>
          ) : (
            <span className="badge draft">free</span>
          )}
          <span className={`badge ${data.role === "admin" ? "active" : "draft"}`}>{data.role}</span>
          {data.deleted && (
            <span className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
              Deleted
            </span>
          )}
        </p>
      </header>

      <div className="px-6 lg:px-10 pt-1 pb-16">
        <UserDetailView data={data} />
      </div>
    </div>
  );
}
