import { prisma } from "@/lib/prisma";
import { calculateNextWarmupTime } from "./scheduler";
import { pickWarmupReceiver, isEntitledToWarmup } from "./pool";
import { generateWarmupContent } from "./content";
import { sendWarmupEmail } from "./sender";
import { decryptAccount } from "@/lib/crypto";
import { canSendFromAccount } from "@/lib/send-gate";
import { categorizeBounce } from "@/lib/bounce";

export async function reconcileWarmupSchedules(): Promise<number> {
  const mailboxes = await prisma.emailAccount.findMany({
    where: {
      warmupEnabled: true,
      isPaused: false,
      status: "active",
      deletedAt: null,
      user: { deletedAt: null },
    },
    select: {
      id: true,
      email: true,
      warmupStartedAt: true,
      userId: true,
      user: { select: { plan: true, trialEndsAt: true, trialVoided: true, deletedAt: true } },
    },
  });

  let seeded = 0;

  for (const mailbox of mailboxes) {
    try {
      // Warmup runs while the owner is on an active trial OR a paid plan.
      // Once the trial ends and they have not paid, warmup is paused.
      if (!isEntitledToWarmup(mailbox.user)) continue;

      const pendingCount = await prisma.warmupLog.count({
        where: {
          senderMailboxId: mailbox.id,
          status: { in: ["scheduled", "sending"] },
        },
      });

      if (pendingCount > 0) continue;

      if (!mailbox.warmupStartedAt) {
        await prisma.emailAccount.update({
          where: { id: mailbox.id },
          data: { warmupStartedAt: new Date() },
        });
      }

      const nextTime = await calculateNextWarmupTime(mailbox.id);
      if (!nextTime) continue;

      // Pick a receiver: a platform seed inbox OR an eligible peer mailbox.
      const receiver = await pickWarmupReceiver({ id: mailbox.id, userId: mailbox.userId });
      if (!receiver) continue;

      const senderName = mailbox.email.split("@")[0];
      const content = await generateWarmupContent(
        mailbox.id,
        senderName,
        {
          seedMailboxId: receiver.kind === "peer" ? receiver.id : null,
          seedInboxId: receiver.kind === "seed" ? receiver.id : null,
        },
      );

      await prisma.warmupLog.create({
        data: {
          senderMailboxId: mailbox.id,
          seedMailboxId: receiver.kind === "peer" ? receiver.id : null,
          seedInboxId: receiver.kind === "seed" ? receiver.id : null,
          subject: content.subject,
          bodyPreview: content.body.slice(0, 200),
          bodyHtml: content.body,
          status: "scheduled",
          sentAt: nextTime,
        },
      });

      seeded++;
    } catch (err) {
      console.error(`Warmup reconcile failed for ${mailbox.email}:`, err);
    }
  }

  return seeded;
}

export async function processDueWarmupSends(): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const dueLogs = await prisma.warmupLog.findMany({
    where: {
      status: "scheduled",
      sentAt: { lte: now },
      // Seed-originated sends are handled by the seed network engine
      // (seed-send.ts) — this path only ships user-mailbox warmup.
      senderMailboxId: { not: null },
    },
    include: {
      senderMailbox: true,
      seedMailbox: true,
      seedInbox: true,
    },
    take: 50,
  });

  let sent = 0;
  let failed = 0;

  for (const log of dueLogs) {
    try {
      if (!log.senderMailbox) {
        await prisma.warmupLog.delete({ where: { id: log.id } });
        continue;
      }
      const sender = decryptAccount(log.senderMailbox) as any;
      if (log.seedMailbox) log.seedMailbox = decryptAccount(log.seedMailbox) as any;
      if (log.seedInbox) log.seedInbox = decryptAccount(log.seedInbox) as any;

      // Resolve the destination address — the receiver is either a peer
      // (user mailbox, seedMailboxId) or a platform seed (seedInboxId).
      let toEmail: string;
      if (log.seedInbox) {
        toEmail = log.seedInbox.email;
      } else if (log.seedMailbox) {
        toEmail = log.seedMailbox.email;
      } else {
        // No valid receiver anymore — drop the stale log.
        await prisma.warmupLog.delete({ where: { id: log.id } });
        continue;
      }

      let subject = log.subject;
      let emailBody = log.bodyHtml || log.bodyPreview || "";

      if (!subject || !emailBody) {
        const senderName = sender.email.split("@")[0];
        const content = await generateWarmupContent(
          sender.id,
          senderName,
          {
            seedMailboxId: log.seedMailbox ? log.seedMailboxId : null,
            seedInboxId: log.seedInboxId,
          },
        );
        subject = content.subject;
        emailBody = content.body;

        await prisma.warmupLog.update({
          where: { id: log.id },
          data: {
            subject: content.subject,
            bodyPreview: content.body.slice(0, 200),
            bodyHtml: content.body,
          },
        });
      }

      await prisma.warmupLog.update({
        where: { id: log.id },
        data: { status: "sending" },
      });

      if (sender.warmupCustomTrackingDomain && sender.customTrackingDomain) {
        emailBody += `\n\n---\n${sender.customTrackingDomain}`;
      }

      const filterTag = sender.warmupFilterTag;
      if (filterTag) {
        subject = `${subject} ${filterTag}`;
        emailBody = `${emailBody}\n\n${filterTag}`;
      }

      const gate = await canSendFromAccount(
        sender.id,
        sender.dailySendLimit || 50,
      );
      if (!gate.allowed) {
        await prisma.warmupLog.update({
          where: { id: log.id },
          data: { status: "scheduled" },
        });
        console.log(`[warmup] Send blocked for ${sender.email}: ${gate.reason}`);
        failed++;
        continue;
      }

      const result = await sendWarmupEmail(
        sender.email,
        sender.smtpHost!,
        sender.smtpPort!,
        sender.smtpUser!,
        sender.smtpPass!,
        sender.displayName || undefined,
        toEmail,
        subject,
        emailBody,
      );

      if (result.success) {
        await prisma.warmupLog.update({
          where: { id: log.id },
          data: {
            status: "sent",
            messageId: result.messageId,
            subject,
            bodyPreview: emailBody.slice(0, 200),
            bodyHtml: emailBody,
            sentAt: new Date(),
          },
        });

        // Mark receiver used for rotation.
        if (log.seedInboxId) {
          await prisma.seedInbox.update({
            where: { id: log.seedInboxId },
            data: { lastUsedAt: new Date() },
          });
        } else if (log.seedMailboxId) {
          await prisma.emailAccount.update({
            where: { id: log.seedMailboxId },
            data: { lastHealthCheckAt: new Date() },
          });
        }

        sent++;
      } else {
        // A failed warmup send. Categorize it so hard vs soft bounces feed the
        // separate bounce signal (kept OUT of the warmup placement health
        // score, exactly like Instantly). Transport/network/auth failures are
        // flagged as non-bounces and recorded so they don't skew the score.
        let bounceType: string | null = "failed";
        try {
          bounceType = result.error ? categorizeBounce({ message: result.error }).type : "failed";
        } catch {
          bounceType = "failed";
        }
        await prisma.warmupLog.update({
          where: { id: log.id },
          data: { status: "failed", bounceType },
        });
        failed++;
      }
    } catch (err) {
      console.error("Warmup send failed:", err);
      await prisma.warmupLog.update({
        where: { id: log.id },
        data: { status: "failed" },
      });
      failed++;
    }
  }

  return { sent, failed };
}
