import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { assertSafeMailTarget } from "@/lib/ssrf";
import { openImap } from "@/lib/oauth-connect";

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

function shouldApply(percent: number): boolean {
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
  "Thanks for following up. I've seen this.",
  "Appreciate the note. I'll review and respond.",
  "Thanks, I'll look into this shortly.",
  "Received, thanks for the heads up.",
  "Good stuff, I'll review this when I get a chance.",
];

function randomReplyBody(): string {
  return REPLY_BODIES[Math.floor(Math.random() * REPLY_BODIES.length)];
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
      headers: {
        "In-Reply-To": originalMessageId,
        "References": originalMessageId,
      },
    });

    await transporter.close();
    return true;
  } catch (err) {
    console.error(`Seed reply failed from ${account.email}:`, err);
    return false;
  }
}

function providerFromEmail(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail")) return "gmail";
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return "outlook";
  if (domain.includes("yahoo")) return "yahoo";
  if (domain.includes("proton")) return "proton";
  return "other";
}

async function connectToAccount(account: {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
}) {
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

// Connect a mailbox for reading warmup sends. OAuth-connected accounts (Gmail /
// Outlook) carry no imapPassword — openImap resolves the refresh token to an
// access token and connects via XOAUTH2. Returns null when the account can't be
// reached; the reader simply skips that mailbox.
async function connectForRead(account: any): Promise<ImapFlow | null> {
  if (account.imapUser && account.imapPass) {
    try {
      return await connectToAccount({
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        imapUser: account.imapUser,
        imapPass: account.imapPass,
      });
    } catch {
      // Stale/incorrect IMAP creds — fall through to the SMTP/OAuth path,
      // which may still hold a working app password or refresh token.
    }
  }
  return openImap(account);
}

async function searchFolderForSenders(
  client: ImapFlow,
  folder: string,
  senderEmails: string[],
): Promise<Map<string, { uid: number; messageId: string; receivedAt: Date }[]>> {
  const results = new Map<string, { uid: number; messageId: string; receivedAt: Date }[]>();

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      for (const sender of senderEmails) {
        const uids = await client.search({ from: sender }, { uid: true });
        if (!uids || uids.length === 0) continue;
        const searchResult: any[] = [];
        for await (const msg of client.fetch(uids, { uid: true, envelope: true, internalDate: true })) {
          searchResult.push(msg);
        }

        if (searchResult.length > 0) {
          const items = searchResult.map(msg => ({
            uid: msg.uid,
            messageId: msg.envelope?.messageId || `unknown-${msg.uid}`,
            receivedAt: msg.internalDate || new Date(),
          }));
          results.set(sender, items);
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

export async function processSeedInboxes(): Promise<{
  received: number;
  replied: number;
  rescued: number;
}> {
  const rawAccounts = await prisma.emailAccount.findMany({
    where: { status: "active", deletedAt: null },
  });
  const accounts = rawAccounts.map(a => decryptAccount(a) as typeof a);

  // Warmup mail also arrives from platform-owned seeds (network self-warm and
  // seed-to-customer sends), so seed inboxes are senders too.
  const rawSeeds = await prisma.seedInbox.findMany({ where: { status: "active" } });
  const seeds = rawSeeds.map(s => decryptAccount(s) as typeof s);

  const senderEmails = [...accounts.map(a => a.email), ...seeds.map(s => s.email)];
  const senderIdByEmail = new Map(accounts.map(a => [a.email, a.id]));
  const seedIdByEmail = new Map(seeds.map(s => [s.email, s.id]));
  const senderSettings = new Map(accounts.map(a => [a.id, { openRate: a.warmupOpenRate ?? 100, spamProtection: a.warmupSpamProtection ?? 100, markImportant: a.warmupMarkImportant ?? 0, readEmulation: a.readEmulation ?? false, replyRate: a.warmupReplyRate ?? 30 }]));
  // Seed senders use their own engagement percentages.
  for (const s of seeds) {
    senderSettings.set(s.id, { openRate: s.openRate ?? 100, spamProtection: s.spamProtection ?? 100, markImportant: s.markImportant ?? 10, readEmulation: false, replyRate: s.replyRate ?? 75 });
  }

  let received = 0;
  let replied = 0;
  let rescued = 0;

  for (const account of accounts) {
    let client: ImapFlow | null = null;

    try {
      const provider = account.provider || providerFromEmail(account.email);
      client = await connectForRead(account);
      if (!client) continue;

      // Sender → warmup log match scope. Mail from another customer mailbox is
      // captured via senderMailboxId; mail from a platform seed via senderInboxId.
      function logScopeFor(senderEmail: string): { senderMailboxId: string } | { senderInboxId: string } | null {
        const accountId = senderIdByEmail.get(senderEmail);
        if (accountId && accountId !== account.id) return { senderMailboxId: accountId };
        const seedId = seedIdByEmail.get(senderEmail);
        if (seedId) return { senderInboxId: seedId };
        return null;
      }

      // 1. Check INBOX for warmup emails
      const inboxResults = await searchFolderForSenders(client, "INBOX", senderEmails);

      for (const [senderEmail, msgs] of inboxResults) {
        const scope = logScopeFor(senderEmail);
        if (!scope) continue;
        const senderId = "senderMailboxId" in scope ? scope.senderMailboxId : scope.senderInboxId;
        const settings = senderSettings.get(senderId);
        const openRate = settings?.openRate ?? 100;

        for (const msg of msgs) {
          const log = await prisma.warmupLog.findFirst({
            where: {
              ...scope,
              seedMailboxId: account.id,
              status: "sent",
              receivedAt: null,
            },
            orderBy: { sentAt: "desc" },
          });

          if (log && shouldApply(openRate)) {
            if (settings?.readEmulation) {
              const delayMs = 5000 + Math.random() * 55000;
              await new Promise(r => setTimeout(r, delayMs));
            }

            const data: any = { receivedAt: msg.receivedAt, status: "delivered" };
            const markImportant = settings?.markImportant ?? 0;
            if (shouldApply(markImportant)) {
              data.markedImportant = true;
            }

            await prisma.warmupLog.update({
              where: { id: log.id },
              data,
            });
            received++;

            const replyRate = settings?.replyRate ?? 30;
            if (shouldApply(replyRate) && msg.messageId && !log.repliedAt && account.smtpHost && account.smtpPort && account.smtpUser && account.smtpPass) {
              const replyDelay = 30000 + Math.random() * 150000;
              await new Promise(r => setTimeout(r, replyDelay));

              const replySent = await sendSeedReply(
                { email: account.email, smtpHost: account.smtpHost!, smtpPort: account.smtpPort!, smtpUser: account.smtpUser!, smtpPass: account.smtpPass! },
                senderEmail,
                log.subject || "Warmup",
                msg.messageId,
              );

              if (replySent) {
                await prisma.warmupLog.update({
                  where: { id: log.id },
                  data: { repliedAt: new Date(), replyReceived: true },
                });
              }
            }
          }
        }
      }

      // 2. Check Spam folders for rescued emails
      const spamFolders = getSpamFolders(provider);
      for (const spamFolder of spamFolders) {
        const spamResults = await searchFolderForSenders(client, spamFolder, senderEmails);

        for (const [senderEmail, msgs] of spamResults) {
          const scope = logScopeFor(senderEmail);
          if (!scope) continue;
          const senderId = "senderMailboxId" in scope ? scope.senderMailboxId : scope.senderInboxId;
          const settings = senderSettings.get(senderId);
          const spamProtection = settings?.spamProtection ?? 100;

          for (const msg of msgs) {
            const log = await prisma.warmupLog.findFirst({
              where: {
                ...scope,
                seedMailboxId: account.id,
                status: "sent",
                foundInSpam: false,
              },
              orderBy: { sentAt: "desc" },
            });

            if (!log) continue;

            const updateData: any = { foundInSpam: true };

            if (shouldApply(spamProtection)) {
              try {
                const lock = await client.getMailboxLock(spamFolder);
                try {
                  await client.messageCopy([msg.uid], "INBOX");
                  await client.messageDelete([msg.uid]);
                } finally {
                  lock.release();
                }
              } catch {
                try {
                  const lock = await client.getMailboxLock(spamFolder);
                  try {
                    await client.messageCopy([msg.uid], "INBOX");
                  } finally {
                    lock.release();
                  }
                } catch {}
              }

              updateData.receivedAt = msg.receivedAt;
              updateData.rescuedFromSpam = true;
              updateData.status = "delivered";

              const markImportant = settings?.markImportant ?? 0;
              if (shouldApply(markImportant)) {
                updateData.markedImportant = true;
              }

              rescued++;
            }

            await prisma.warmupLog.update({
              where: { id: log.id },
              data: updateData,
            });
          }
        }
      }

      // 3. Check Promotions category (Gmail) and move to INBOX
      const promoFolders = ["[Gmail]/Promotions", "Promotions"];
      for (const promoFolder of promoFolders) {
        try {
          const promoResults = await searchFolderForSenders(client, promoFolder, senderEmails);

          for (const [senderEmail, msgs] of promoResults) {
            const scope = logScopeFor(senderEmail);
            if (!scope) continue;

            for (const msg of msgs) {
              const log = await prisma.warmupLog.findFirst({
                where: {
                  ...scope,
                  seedMailboxId: account.id,
                  status: "sent",
                  foundInSpam: false,
                },
                orderBy: { sentAt: "desc" },
              });

              if (!log) continue;

              try {
                const lock = await client.getMailboxLock(promoFolder);
                try {
                  await client.messageMove([msg.uid], "INBOX");
                } finally {
                  lock.release();
                }

                await prisma.warmupLog.update({
                  where: { id: log.id },
                  data: {
                    receivedAt: msg.receivedAt,
                    status: "delivered",
                  },
                });
                rescued++;
              } catch {
                // Folder may not exist or move failed
              }
            }
          }
        } catch {
          // Promotions folder may not exist for this provider
        }
      }
    } catch (err) {
      console.error(`IMAP processing failed for account ${account.email}:`, err);
    } finally {
      if (client) {
        try { await client.logout(); } catch {}
      }
    }
  }

  return { received, replied, rescued };
}
