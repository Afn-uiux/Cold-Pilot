import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = {
  payment_succeeded: "One-time payment",
  subscription_started: "Subscription payment",
  subscription_renewed: "Subscription renewal",
  subscription_past_due: "Subscription payment",
  subscription_canceled: "Subscription canceled",
  plan_downgraded: "Plan change",
};

function itemDescription(type: string, plan: string | null, amount: number | null, currency: string): string {
  if (plan && PLANS[plan as keyof typeof PLANS]) {
    return `${PLANS[plan as keyof typeof PLANS].name} plan`;
  }
  if (type === "payment_succeeded" && typeof amount === "number") {
    const pack = CREDIT_PACKS.find((p) => {
      // pack.price is always expressed in Naira; convert for USD purchases.
      if (currency === "USD") return Math.abs(amount - p.price / 1500) < 0.001;
      return Math.abs(amount - p.price) < 0.001;
    });
    if (pack) return `${pack.credits.toLocaleString()} credits`;
  }
  return TYPE_LABELS[type] || "Charge";
}

function invoiceNumber(providerEventId: string): string {
  return `CP-${providerEventId.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase()}`;
}

function formatMoney(amount: number | null, currency: string): string {
  if (typeof amount !== "number") return "—";
  // amount is stored in the currency's major units.
  if (currency === "USD") {
    const usd = amount % 1 === 0 ? amount.toLocaleString() : amount.toFixed(2).replace(/\.?0+$/, "");
    return `$${usd}`;
  }
  return `₦${amount.toLocaleString()}`;
}

export default async function InvoicePage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { eventId } = await params;
  const event = await prisma.paymentEvent.findUnique({
    where: { providerEventId: eventId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  const desc = itemDescription(event.type, event.plan, event.amount, event.currency);
  const amount = formatMoney(event.amount, event.currency);
  const date = new Date(event.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="card">
        <div className="card-header">
          <h3>Invoice {invoiceNumber(event.providerEventId)}</h3>
          <Link href="/dashboard/settings?tab=Billing" className="btn btn-ghost btn-sm">Back to billing</Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 py-2">
          <div>
            <p className="metric-label">Billed to</p>
            <p className="text-sm mt-1">{event.user.name || event.user.email}</p>
            <p className="text-xs text-muted">{event.user.email}</p>
          </div>
          <div>
            <p className="metric-label">Invoice date</p>
            <p className="text-sm mt-1">{date}</p>
          </div>
        </div>

        <div className="table-wrap mt-6">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{desc}</td>
                <td style={{ textAlign: "right" }}>{amount}</td>
              </tr>
              <tr>
                <td><strong>Total</strong></td>
                <td style={{ textAlign: "right" }}><strong>{amount}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-2 mt-6">
          Reference: <span className="font-mono">{event.providerEventId}</span>
          {event.subscriptionId ? <> · Subscription: <span className="font-mono">{event.subscriptionId}</span></> : null}
        </p>
      </div>
    </div>
  );
}