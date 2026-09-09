import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { assertSafeMailTarget } from "@/lib/ssrf";
import { openImap } from "@/lib/oauth-connect";

// Seed engagement engine: makes platform-owned seed inboxes behave like real,
// live mailboxes. Seeds RECEIVE warmup (from user mailboxes and other seeds),
// mark as delivered/important, rescue from spam, and REPLY back to the sender.

const SPAM_FOLDERS: Record<string, string[]> = {
  gmail: ["[Gmail]/Spam", "Spam"],
  outlook: ["Junk", "Junk Email"],
  yahoo: ["Spam", "Bulk Mail"],
  proton: ["Spam"],
  other: ["Spam", "Junk", "Junk Email"],
};

function getSpamFolders(provider: string): string[] {
  return SPAM_FOLDERS[provider.toLowerCase()] || SPAM_FOLDERS.other;
}

function providerFromEmail(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail")) return "gmail";
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return "outlook";
  if (domain.includes("yahoo")) return "yahoo";
  if (domain.includes("proton")) return "proton";
  return "other";
}

function shouldApply(percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return Math.random() * 100 < percent;
}

const REPLY_BODIES = [
  "Thanks for reaching out, I'll take a look at this.",
  "Got it, will review and get back to you.",
  "Thanks for the note. I'll follow up shortly.",
  "Appreciate you sending this over. Let me check.",
  "Received, thanks. I'll circle back soon.",
  "Good to hear from you. Let me review this.",
  "Thanks, this looks interesting. I'll review.",
  "Noted, thanks for the update.",
  "Thanks for sharing. I'll take a closer look.",
  "Got your message. Will get back to you shortly.",
];

function randomReplyBody(): string {
  return REPLY_BODIES[Math.floor(Math.random() * REPLY_BODIES.length)];
}

async function connect(account: { imapHost: string; imapPort: number; imapUser: string; imapPass: string }) {
  // SSRF guard: imapHost/imapPort come from user-configured account settings.
  await assertSafeMailTarget(account.imapHost, account.imapPort, "IMAP");
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: true,
    auth: { user: account.imapUser, pass: account.imapPass },
    logger: false,
  });
  await client.connect();
  return client;
}

// Seed inboxes connect via Google OAuth (admin "google" flow) or plain IMAP.
// openImap handles both; returns null when unreachable so the loop skips it.
async function connectForRead(account: any): Promise<ImapFlow | null> {
  if (account.imapUser && account.imapPass) {
    return connect({
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      imapUser: account.imapUser,
      imapPass: account.imapPass,
    });
  }
  return openImap(account);
}

async function searchFolder(client: ImapFlow, folder: string, senderEmails: string[]) {
  const results = new Map<string, { uid: number; messageId: string; receivedAt: Date }[]>();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      for (const sender of senderEmails) {
        const list: any[] = [];
        for await (const msg of client.fetch(`FROM "${sender}"`, { uid: true, envelope: true, internalDate: true })) {
          list.push(msg);
        }
        if (list.length > 0) {
          results.set(sender, list.map(m => ({
            uid: m.uid,
            messageId: m.envelope?.messageId || `unknown-${m.uid}`,
            receivedAt: m.internalDate || new Date(),
          })));
        }
      }
    } finally {
      lock.release();
    }
  } catch {
    // Folder may not exist
  }
  return results;
}

async function sendSeedReply(
  account: { email: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string },
  toEmail: string,
  originalSubject: string,
  originalMessageId: string,
): Promise<boolean> {
  const subject = originalSubject.toLowerCase().startsWith("re:")
    ? originalSubject
    : `Re: ${originalSubject}`;
  const body = randomReplyBody();
  try {
    // SSRF guard: smtpHost/smtpPort come from user-configured account settings.
    await assertSafeMailTarget(account.smtpHost, account.smtpPort, "SMTP");
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465,
      auth: { user: account.smtpUser, pass: account.smtpPass },
    });
    const info = await transporter.sendMail({
      from: account.email,
      to: toEmail,
      subject,
      text: body,
      headers: { "In-Reply-To": originalMessageId, "References": originalMessageId },
    });
    await transporter.close();
    return true;
  } catch (err) {
    console.error(`Seed reply failed from ${account.email}:`, err);
    return false;
  }
}

export async function processSeedInboxEngagement(): Promise<{
  received: number;
  replied: number;
  rescued: number;
}> {
  const rawSeeds = await prisma.seedInbox.findMany({ where: { status: "active" } });
  const seeds = rawSeeds.map(s => decryptAccount(s) as any);
  if (seeds.length === 0) return { received: 0, replied: 0, rescued: 0 };

  // Potential senders: any active user mailbox (customers) plus other seeds.
  const userAccounts = await prisma.emailAccount.findMany({
    where: { status: "active", deletedAt: null },
    select: { email: true },
  });
  const senderEmails = [
    ...userAccounts.map(a => a.email),
    ...seeds.map(s => s.email),
  ];

  let received = 0;
  let replied = 0;
  let rescued = 0;

  for (const seed of seeds) {
    let client: ImapFlow | null = null;
    try {
      const provider = seed.provider || providerFromEmail(seed.email);
      client = await connectForRead(seed);
      if (!client) continue;

      // Match a sender email to the warmup log that used THIS seed as receiver.
      async function findLog(senderEmail: string, senderIsUser: boolean) {
        if (senderIsUser) {
          return prisma.warmupLog.findFirst({
            where: {
              seedInboxId: seed.id,
              senderMailbox: { email: senderEmail },
              status: "sent",
              receivedAt: null,
            },
            orderBy: { sentAt: "desc" },
          });
        }
        // Sender is another seed (network self-warm) — match by seed sender.
        return prisma.warmupLog.findFirst({
          where: {
            seedInboxId: seed.id,
            senderInbox: { email: senderEmail },
            status: "sent",
            receivedAt: null,
          },
          orderBy: { sentAt: "desc" },
        });
      }

      // INBOX: mark delivered / reply
      const inbox = await searchFolder(client, "INBOX", senderEmails);
      for (const [senderEmail, msgs] of inbox) {
        const senderIsUser = userAccounts.some(a => a.email === senderEmail);
        for (const msg of msgs) {
          const log = await findLog(senderEmail, senderIsUser);
          if (!log) continue;

          const data: any = { receivedAt: msg.receivedAt, status: "delivered" };
          if (shouldApply(seed.markImportant ?? 10)) data.markedImportant = true;
          await prisma.warmupLog.update({ where: { id: log.id }, data });
          received++;

          if (!log.repliedAt && seed.smtpHost && seed.smtpPort && seed.smtpUser && seed.smtpPass && msg.messageId && shouldApply(seed.replyRate ?? 75)) {
            await new Promise(r => setTimeout(r, 30000 + Math.random() * 150000));
            const ok = await sendSeedReply(
              { email: seed.email, smtpHost: seed.smtpHost, smtpPort: seed.smtpPort, smtpUser: seed.smtpUser, smtpPass: seed.smtpPass },
              senderEmail,
              log.subject || "Warmup",
              msg.messageId,
            );
            if (ok) {
              await prisma.warmupLog.update({ where: { id: log.id }, data: { repliedAt: new Date(), replyReceived: true } });
              replied++;
            }
          }
        }
      }

      // Spam/Promotions: rescue to INBOX
      const folders = [...getSpamFolders(provider), "[Gmail]/Promotions", "Promotions"];
      for (const folder of folders) {
        const found = await searchFolder(client, folder, senderEmails);
        for (const [senderEmail, msgs] of found) {
          const senderIsUser = userAccounts.some(a => a.email === senderEmail);
          for (const msg of msgs) {
            const log = await findLog(senderEmail, senderIsUser);
            if (!log) continue;
            if (!shouldApply(seed.spamProtection ?? 100)) continue; // leave some in spam
            try {
              const lock = await client.getMailboxLock(folder);
              try {
                await client.messageCopy([msg.uid], "INBOX");
                await client.messageDelete([msg.uid]).catch(() => {});
              } finally {
                lock.release();
              }
            } catch {}
            await prisma.warmupLog.update({
              where: { id: log.id },
              data: { foundInSpam: true, rescuedFromSpam: true, receivedAt: msg.receivedAt, status: "delivered" },
            });
            rescued++;
          }
        }
      }
    } catch (err) {
      console.error(`Seed engagement failed for ${seed.email}:`, err);
    } finally {
      if (client) { try { await client.logout(); } catch {} }
    }
  }

  return { received, replied, rescued };
}
