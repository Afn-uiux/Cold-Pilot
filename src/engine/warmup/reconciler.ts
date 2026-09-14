import { prisma } from "@/lib/prisma";
import { calculateNextWarmupTime } from "./scheduler";
import { pickWarmupReceiver, isEntitledToWarmup } from "./pool";
import { generateWarmupContent } from "./content";
import { sendWarmupEmail } from "./sender";
import { decryptAccount } from "@/lib/crypto";
import { canSendFromAccount } from "@/lib/send-gate";
import { categorizeBounce } from "@/lib/bounce";
import { createNotification } from "@/lib/notify";
import { sendEmailSafe } from "@/lib/email/send";
import { runConcurrent } from "@/lib/concurrency";

// A failed SMTP auth on warmup means the stored app password is wrong/revoked —
// the mailbox physically cannot send anymore. Broaden past bounce.ts (which is
// tuned for delivery errors) so nodemailer's EAUTH / "Invalid login" / Gmail's
// "Username and Password not accepted" all count as credential failures.
function isWarmupAuthError(error: string | null | undefined): boolean {
  if (!error) return false;
  const msg = error.toLowerCase();
  return (
    msg.includes("eauth") ||
    msg.includes("eaccess") ||
    msg.includes("invalid_grant") ||
    msg.includes("invalid login") ||
    msg.includes("invalid credentials") ||
    msg.includes("username and password not accepted") ||
    msg.includes("authentication failed") ||
    msg.includes("5.7.8") ||
    msg.includes("5.7.0") ||
    (msg.includes("auth") && msg.includes("login"))
  );
}

// One-shot credential-blocked handling: disable warmup, pause the mailbox, and
// mail the owner. Returns true when it actually disabled the account (so the
// caller can avoid re-notifying if the account was already disabled).
async function handleWarmupCredentialFailure(
  sender: any,
): Promise<boolean> {
  try {
    // Re-read inside the handler: multiple due logs from the same mailbox can
    // race through runConcurrent, and only the FIRST transitioner to a broken
    // account should mail the owner.
    const fresh = await prisma.emailAccount.findUnique({
      where: { id: sender.id },
      select: { email: true, userId: true, warmupEnabled: true },
    });
    if (!fresh) return false;
    const becomesDisabled = fresh.warmupEnabled !== false;
    await prisma.emailAccount.update({
      where: { id: sender.id },
      data: { warmupEnabled: false, isPaused: true, status: "error" },
    });
    // Cancel any still-scheduled/sending warmups from this mailbox so the dead
    // account isn't retried every tick, and record them as failed instead.
    await prisma.warmupLog.updateMany({
      where: { senderMailboxId: sender.id, status: { in: ["scheduled", "sending"] } },
      data: { status: "failed", bounceType: "auth_error" },
    });
    createNotification({
      userId: fresh.userId,
      type: "account_error",
      title: "Reconnect your email account",
      message: `${fresh.email} was disconnected — warmup was paused because we could no longer sign in with its saved app password.`,
    }).catch(() => {});
    if (becomesDisabled) {
      const user = await prisma.user.findUnique({
        where: { id: fresh.userId },
        select: { email: true },
      });
      if (user?.email) sendEmailSafe(user.email, "account-disconnected", { email: fresh.email });
    }
    return true;
  } catch (err) {
    console.error("Failed to disable account after warmup auth error:", err);
    return false;
  }
}

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
      displayName: true,
      warmupStartedAt: true,
      userId: true,
      smtpUser: true,
      smtpPass: true,
      user: { select: { plan: true, trialEndsAt: true, trialVoided: true, deletedAt: true } },
    },
  });

  let seeded = 0;

  for (const mailbox of mailboxes) {
    try {
      // Warmup runs while the owner is on an active trial OR a paid plan.
      // Once the trial ends and they have not paid, warmup is paused.
      if (!isEntitledToWarmup(mailbox.user)) continue;

      // Warmup needs a real SMTP identity. OAuth-only accounts (no app
      // password) cannot send, so they must never be scheduled — they'd only
      // accumulate failed sends and soak the pool as dead weight.
      if (!mailbox.smtpPass || !mailbox.smtpUser) continue;

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

      const senderName = mailbox.displayName || mailbox.email.split("@")[0];
      const content = await generateWarmupContent(
        mailbox.id,
        senderName,
        receiver.name || receiver.email.split("@")[0],
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

  // Reconcile only ever schedules one pending warmup per sender mailbox
  // (pendingCount === 0 gate above), so every due log here has a DISTINCT
  // sender. Sending them concurrently (capped) overlaps the SMTP round-trips
  // and AI content generation without any risk of two parallel sends from the
  // same mailbox.
  await runConcurrent(dueLogs, async (log) => {
    try {
      if (!log.senderMailbox) {
        await prisma.warmupLog.delete({ where: { id: log.id } });
        return;
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
        return;
      }

      let subject = log.subject;
      let emailBody = log.bodyHtml || log.bodyPreview || "";

      if (!subject || !emailBody) {
        const senderName = sender.displayName || sender.email.split("@")[0];
        const receiverObj = log.seedInbox || log.seedMailbox;
        const recipientName = receiverObj ?
          (receiverObj.displayName?.split(/\s+/)[0] || receiverObj.email.split("@")[0]) : "";
        const content = await generateWarmupContent(
          sender.id,
          senderName,
          recipientName,
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
        return;
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

        // A credential failure means this mailbox can no longer send at all.
        // Disable warmup, pause it, and (once) email the owner — warmup must
        // never keep retrying (or keep being used as a receiver) with a broken
        // app password.
        if (isWarmupAuthError(result.error)) {
          await handleWarmupCredentialFailure(sender);
        }
      }
    } catch (err) {
      console.error("Warmup send failed:", err);
      await prisma.warmupLog.update({
        where: { id: log.id },
        data: { status: "failed" },
      });
      failed++;
    }
  });

  return { sent, failed };
}
