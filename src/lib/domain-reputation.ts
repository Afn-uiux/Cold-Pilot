import { prisma } from "./prisma";
import { sendEmailSafe } from "./email/send";

const HIGH_BOUNCE_THRESHOLD = 0.3;
const MEDIUM_BOUNCE_THRESHOLD = 0.15;
const MIN_SAMPLES_FOR_TRUST = 10;

export interface DomainReputationResult {
  domain: string;
  totalSent: number;
  totalBounced: number;
  bounceRate: number;
  riskLevel: "safe" | "low" | "medium" | "high";
  lastBouncedAt: Date | null;
}

export async function recordBounce(
  email: string,
  errorCode: string | null,
  bounceType: string,
  reason: string | null,
  emailAccountId: string | null,
  leadId: string | null,
): Promise<void> {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain) return;

  await prisma.bounceEvent.create({
    data: {
      email: email.toLowerCase().trim(),
      domain,
      errorCode,
      bounceType,
      reason,
      emailAccountId,
      leadId,
    },
  });

  const domainStats = await prisma.bounceEvent.aggregate({
    where: { domain },
    _count: { id: true },
  });
  const totalBounced = domainStats._count.id;

  const existing = await prisma.domainReputation.findUnique({ where: { domain } });
  if (existing) {
    const bounceRate = existing.totalSent > 0 ? totalBounced / existing.totalSent : 1;
    await prisma.domainReputation.update({
      where: { domain },
      data: {
        totalBounced,
        bounceRate,
        lastBouncedAt: new Date(),
      },
    });
    // Send bounce rate alert if crossing threshold
    if (existing.totalSent >= MIN_SAMPLES_FOR_TRUST && bounceRate >= MEDIUM_BOUNCE_THRESHOLD) {
      // Find the user who owns this domain's email accounts
      const account = await prisma.emailAccount.findFirst({
        where: { email: { endsWith: `@${domain}` } },
        select: { userId: true },
      });
      if (account) {
        const user = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
        if (user?.email) sendEmailSafe(user.email, "bounce-rate-alert");
      }
    }
  } else {
    await prisma.domainReputation.create({
      data: {
        domain,
        totalSent: totalBounced,
        totalBounced,
        bounceRate: 1,
        lastBouncedAt: new Date(),
      },
    });
  }
}

export async function recordSend(email: string): Promise<void> {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain) return;

  await prisma.domainReputation.upsert({
    where: { domain },
    create: {
      domain,
      totalSent: 1,
      totalBounced: 0,
      bounceRate: 0,
    },
    update: {
      totalSent: { increment: 1 },
    },
  });
}

export async function getDomainReputation(domain: string): Promise<DomainReputationResult> {
  const record = await prisma.domainReputation.findUnique({ where: { domain } });

  if (!record) {
    return {
      domain,
      totalSent: 0,
      totalBounced: 0,
      bounceRate: 0,
      riskLevel: "safe",
      lastBouncedAt: null,
    };
  }

  let riskLevel: "safe" | "low" | "medium" | "high" = "safe";
  if (record.totalSent >= MIN_SAMPLES_FOR_TRUST) {
    if (record.bounceRate >= HIGH_BOUNCE_THRESHOLD) riskLevel = "high";
    else if (record.bounceRate >= MEDIUM_BOUNCE_THRESHOLD) riskLevel = "medium";
    else if (record.bounceRate > 0) riskLevel = "low";
  }

  // Send domain reputation warning if risk level is medium or high
  if (riskLevel === "medium" || riskLevel === "high") {
    const account = await prisma.emailAccount.findFirst({
      where: { email: { endsWith: `@${domain}` } },
      select: { userId: true },
    });
    if (account) {
      const user = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
      if (user?.email) sendEmailSafe(user.email, "domain-reputation-warning");
    }
  }

  return {
    domain: record.domain,
    totalSent: record.totalSent,
    totalBounced: record.totalBounced,
    bounceRate: record.bounceRate,
    riskLevel,
    lastBouncedAt: record.lastBouncedAt,
  };
}

export function isHighBounceDomain(reputation: DomainReputationResult): boolean {
  return reputation.riskLevel === "high";
}

export function isMediumBounceDomain(reputation: DomainReputationResult): boolean {
  return reputation.riskLevel === "medium" || reputation.riskLevel === "high";
}
