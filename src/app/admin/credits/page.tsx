export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import ExportCsvButton, { SectionHead } from "@/app/admin/_components/export-csv-button";
import StatStrip from "@/app/admin/_components/stat-strip";

export default async function AdminCreditsPage() {
  const [outstanding, granted, spent, byReason, topHolders, recent, byPlan, recentPayments, lapsedPayers] =
    await Promise.all([
      prisma.user.aggregate({ _sum: { creditBalance: true } }),
      prisma.creditTransaction.aggregate({
        where: { amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.groupBy({
        by: ["reason"],
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.user.findMany({
        orderBy: { creditBalance: "desc" },
        take: 10,
        select: { id: true, name: true, email: true, plan: true, creditBalance: true },
      }),
      prisma.creditTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          reason: true,
          refId: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.user.groupBy({
        by: ["plan"],
        _count: { _all: true },
        _sum: { creditBalance: true },
      }),
      prisma.paymentEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          plan: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      // Lapsed payers: users with a real payment/started/renewed event in the
      // past whose plan is free today — "paid this month, not next month".
      prisma.user.findMany({
        where: {
          plan: "free",
          paymentEvents: {
            some: {
              type: { in: ["payment_succeeded", "subscription_started", "subscription_renewed"] },
            },
          },
        },
        take: 20,
        select: {
          id: true,
          email: true,
          plan: true,
          bachsSubscriptionId: true,
          paymentEvents: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { type: true, amount: true, currency: true, createdAt: true },
          },
        },
      }),
    ]);

  const sortedReasons = [...byReason].sort(
    (a, b) => Math.abs(b._sum.amount ?? 0) - Math.abs(a._sum.amount ?? 0),
  );

  return (
    <div>
      <header className="px-6 lg:px-10 pt-8 pb-0">
        <h1 className="font-medium text-[clamp(28px,3.5vw,36px)] tracking-tight leading-tight">
          Credits
        </h1>
        <p className="text-sm text-muted mt-1.5">Balances, spend and grants across the platform</p>
      </header>

      <div className="px-6 lg:px-10 pt-7 pb-16">
        <StatStrip
          items={[
            { label: "Outstanding", value: String(Math.round(outstanding._sum.creditBalance ?? 0)), sub: "sum of all balances" },
            { label: "Granted", value: `+${Math.round(granted._sum.amount ?? 0)}`, sub: "all-time top-ups & trials" },
            { label: "Spent", value: String(Math.round(spent._sum.amount ?? 0)), sub: "all-time consumption" },
            {
              label: "Paid users",
              value: String(byPlan.filter((r) => r.plan !== "free").reduce((n, r) => n + r._count._all, 0)),
              sub: `${byPlan.reduce((n, r) => n + r._count._all, 0)} total users`,
            },
          ]}
        />

        <div className="mt-8 card">
          <SectionHead title="Plans">
            <ExportCsvButton
              filename="credits-by-plan.csv"
              rows={byPlan.map((row) => ({
                plan: row.plan,
                users: String(row._count._all),
                creditsHeld: String(Math.round(row._sum.creditBalance ?? 0)),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Users</th>
                  <th>Credits held</th>
                </tr>
              </thead>
              <tbody>
                {byPlan.length === 0 && (
                  <tr><td colSpan={3} className="text-muted">No users yet</td></tr>
                )}
                {byPlan.map((row) => (
                  <tr key={row.plan}>
                    <td className="font-medium">
                      {row.plan !== "free" ? (
                        <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {row.plan}
                        </span>
                      ) : (
                        <span className="badge draft">free</span>
                      )}
                    </td>
                    <td>{row._count._all}</td>
                    <td>{Math.round(row._sum.creditBalance ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="card">
            <SectionHead title="Spend by action">
              <ExportCsvButton
                filename="credits-by-action.csv"
                rows={sortedReasons.map((row) => ({
                  action: row.reason,
                  events: String(row._count._all),
                  total: String(Math.round(row._sum.amount ?? 0)),
                }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Events</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReasons.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">No credit activity yet</td></tr>
                  )}
                  {sortedReasons.map((row) => (
                    <tr key={row.reason}>
                      <td className="font-medium">{row.reason}</td>
                      <td>{row._count._all}</td>
                      <td>{Math.round(row._sum.amount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <SectionHead title="Top balances">
              <ExportCsvButton
                filename="top-balances.csv"
                rows={topHolders.map((u) => ({
                  user: u.email,
                  plan: u.plan,
                  balance: String(Math.round(u.creditBalance)),
                }))}
              />
            </SectionHead>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {topHolders.length === 0 && (
                    <tr><td colSpan={3} className="text-muted">No users yet</td></tr>
                  )}
                  {topHolders.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.email}</td>
                      <td className="text-muted">{u.plan}</td>
                      <td>{Math.round(u.creditBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Recent transactions">
            <ExportCsvButton
              filename="credit-transactions.csv"
              rows={recent.map((t) => ({
                user: t.user.email,
                amount: String(Math.round(t.amount)),
                reason: t.reason,
                when: t.createdAt.toLocaleString(),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={4} className="text-muted">No transactions yet</td></tr>
                )}
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.user.email}</td>
                    <td>
                      <span className={t.amount < 0 ? "text-muted" : ""}>
                        {t.amount < 0 ? "" : "+"}{Math.round(t.amount)}
                      </span>
                    </td>
                    <td className="text-muted">{t.reason}</td>
                    <td className="text-muted">{t.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Payment history">
            <ExportCsvButton
              filename="payment-history.csv"
              rows={recentPayments.map((p) => ({
                user: p.user.email,
                event: p.type.replaceAll("_", " "),
                amount: p.amount != null ? String(p.amount) : "",
                currency: p.currency,
                plan: p.plan ?? "",
                when: p.createdAt.toLocaleString(),
              }))}
            />
          </SectionHead>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Plan</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">No payments recorded yet — history starts accumulating once billing is enabled</td></tr>
                )}
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.user.email}</td>
                    <td>{p.type.replaceAll("_", " ")}</td>
                    <td className="text-muted">
                      {p.amount != null ? `${p.currency} ${p.amount.toLocaleString()}` : "—"}
                    </td>
                    <td className="text-muted">{p.plan ?? "—"}</td>
                    <td className="text-muted">{p.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 card">
          <SectionHead title="Lapsed payers">
            <ExportCsvButton
              filename="lapsed-payers.csv"
              rows={lapsedPayers.map((u) => {
                const last = u.paymentEvents[0];
                return {
                  user: u.email,
                  lastEvent: last ? last.type.replaceAll("_", " ") : "",
                  amount: last?.amount != null ? String(last.amount) : "",
                  when: last?.createdAt.toLocaleString() ?? "",
                };
              })}
            />
          </SectionHead>
          <p className="text-sm text-muted font-normal -mt-2 mb-4">paid before, free now</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Last payment event</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {lapsedPayers.length === 0 && (
                  <tr><td colSpan={3} className="text-muted">Nobody has lapsed — everyone who paid is still on a paid plan</td></tr>
                )}
                {lapsedPayers.map((u) => {
                  const last = u.paymentEvents[0];
                  return (
                    <tr key={u.id}>
                      <td className="font-medium">{u.email}</td>
                      <td className="text-muted">
                        {last ? `${last.type.replaceAll("_", " ")}${last.amount != null ? ` · ${last.currency} ${last.amount.toLocaleString()}` : ""}` : "—"}
                      </td>
                      <td className="text-muted">{last?.createdAt.toLocaleString() ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
