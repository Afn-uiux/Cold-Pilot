import { prisma } from "@/lib/prisma";
import { calculateNextWarmupTime } from "./scheduler";
import { pickWarmupPartner } from "./partner";
import { generateWarmupContent } from "./content";
import { sendWarmupEmail } from "./sender";
import { decryptAccount } from "@/lib/crypto";
import { canSendFromAccount } from "@/lib/send-gate";

export async function reconcileWarmupSchedules(): Promise<number> {
  const mailboxes = await prisma.emailAccount.findMany({
    where: {
      warmupEnabled: true,
      isPaused: false,
      status: "active",
    },
    select: {
      id: true,
      email: true,
      warmupStartedAt: true,
    },
  });

  let seeded = 0;

  for (const mailbox of mailboxes) {
    try {
      // Check if there's already a pending/upcoming warmup log
      const pendingCount = await prisma.warmupLog.count({
        where: {
          senderMailboxId: mailbox.id,
          status: { in: ["scheduled", "sending"] },
        },
      });

      if (pendingCount > 0) continue;

      // Start warmup if not started
      if (!mailbox.warmupStartedAt) {
        await prisma.emailAccount.update({
          where: { id: mailbox.id },
          data: { warmupStartedAt: new Date() },
        });
      }

      // Calculate next send time
      const nextTime = await calculateNextWarmupTime(mailbox.id);
      if (!nextTime) continue;

      // Pick a partner seed
      const partner = await pickWarmupPartner(mailbox.id, mailboxes.length);
      if (!partner) continue;

      // Generate content
      const senderName = mailbox.email.split("@")[0];
      const content = await generateWarmupContent(mailbox.id, senderName, partner.id);

      // Create scheduled warmup log
      await prisma.warmupLog.create({
        data: {
          senderMailboxId: mailbox.id,
          seedMailboxId: partner.id,
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
    },
    include: {
      senderMailbox: true,
      seedMailbox: true,
    },
    take: 50,
  });

  let sent = 0;
  let failed = 0;

  for (const log of dueLogs) {
    try {
      // Decrypt credentials
      log.senderMailbox = decryptAccount(log.senderMailbox) as any;
      log.seedMailbox = decryptAccount(log.seedMailbox) as any;

      // Use stored content if available, otherwise regenerate
      let subject = log.subject;
      let emailBody = log.bodyHtml || log.bodyPreview || "";

      if (!subject || !emailBody) {
        const senderName = log.senderMailbox.email.split("@")[0];
        const content = await generateWarmupContent(
          log.senderMailboxId,
          senderName,
          log.seedMailboxId,
        );
        subject = content.subject;
        emailBody = content.body;

        // Persist regenerated content back to the log
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

      if (log.senderMailbox.warmupCustomTrackingDomain && log.senderMailbox.customTrackingDomain) {
        emailBody += `\n\n---\n${log.senderMailbox.customTrackingDomain}`;
      }

      // Shared send gate — respects campaign sends too
      const gate = await canSendFromAccount(
        log.senderMailboxId,
        log.senderMailbox.dailySendLimit || 50,
      );
      if (!gate.allowed) {
        // Skip this warmup send, retry next tick
        await prisma.warmupLog.update({
          where: { id: log.id },
          data: { status: "scheduled" },
        });
        console.log(`[warmup] Send blocked for ${log.senderMailbox.email}: ${gate.reason}`);
        failed++;
        continue;
      }

      const result = await sendWarmupEmail(
        log.senderMailbox.email,
        log.senderMailbox.smtpHost!,
        log.senderMailbox.smtpPort!,
        log.senderMailbox.smtpUser!,
        log.senderMailbox.smtpPass!,
        log.senderMailbox.displayName || undefined,
        log.seedMailbox.email,
        subject,
        emailBody,
      );

      if (result.success) {
        await prisma.warmupLog.update({
          where: { id: log.id },
          data: {
            status: "sent",
            messageId: result.messageId,
            subject: subject,
            bodyPreview: emailBody.slice(0, 200),
            bodyHtml: emailBody,
            sentAt: new Date(),
          },
        });

        // Update receiver lastHealthCheckAt as lastUsed proxy
        await prisma.emailAccount.update({
          where: { id: log.seedMailboxId },
          data: { lastHealthCheckAt: new Date() },
        });

        sent++;
      } else {
        await prisma.warmupLog.update({
          where: { id: log.id },
          data: { status: "failed" },
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
