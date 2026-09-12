import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { assertSafeMailTarget } from "@/lib/ssrf";
import { openImap } from "@/lib/oauth-connect";
import { openDelayMinutes } from "./open-delay";
import { buildWarmupReplyBody, nameFromEmail } from "./reply";

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

async function sendSeedReply(
  account: { email: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string },
  toEmail: string,
  originalSubject: string,
  originalMessageId: string,
  originalBodyPreview?: string | null,
  fromName?: string | null,
  toName?: string | null,
): Promise<boolean> {
  const subject = originalSubject.toLowerCase().startsWith("re:")
    ? originalSubject
    : `Re: ${originalSubject}`;

  const body = await buildWarmupReplyBody(originalSubject, originalBodyPreview, fromName, toName);

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

// Best-effort mark a message as read (\Seen) so warmup mail actually looks
// opened in the real mailbox. UID-scoped; failures must not break processing.
async function markSeen(client: ImapFlow, folder: string, uids: number[]): Promise<void> {
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd([...uids], ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } catch {}
}

// Pair a physical inbox message to ITS warmup log. Search results come back
// oldest-first but logs were matched newest-first, which skewed when a sender
// has several warmup emails in the folder. Message-ID linking is exact (the
// nodemailer Message-ID survives to the IMAP envelope), so prefer it; a reply
// (In-Reply-To pointing at a known warmup) is a follow-up, not a new delivery,
// and is skipped; only truly unknown mail falls back to the oldest-unread log.
async function matchLogForMessage(
  msg: FoundMessage,
  where: Record<string, unknown>,
): Promise<any> {
  const mid = msg.messageId && !msg.messageId.startsWith("unknown-") ? msg.messageId : null;
  if (mid) {
    const byMid = await prisma.warmupLog.findFirst({
      where: { ...where, status: "sent", receivedAt: null, messageId: mid },
      orderBy: { sentAt: "desc" },
    });
    if (byMid) return byMid;
  }
  if (msg.inReplyTo) {
    const parent = await prisma.warmupLog.findFirst({
      where: { ...where, messageId: msg.inReplyTo },
      orderBy: { sentAt: "desc" },
    });
    if (parent) return null;
  }
  return prisma.warmupLog.findFirst({
    where: { ...where, status: "sent", receivedAt: null },
    orderBy: { sentAt: "desc" },
  });
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

type FoundMessage = {
  uid: number;
  messageId: string;
  inReplyTo?: string | null;
  receivedAt: Date;
};

async function searchFolderForSenders(
  client: ImapFlow,
  folder: string,
  senderEmails: string[],
  tagsByEmail: Map<string, string>,
): Promise<Map<string, FoundMessage[]>> {
  const results = new Map<string, FoundMessage[]>();

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      for (const sender of senderEmails) {
        // Identify warmup mail precisely: sender's own filter tag is stamped
        // into the subject of every warmup they send (reconciler/seedContent),
        // so require it in the search. Without the tag a real non-warmup email
        // from the same sender could be mistaken for warmup.
        const tag = (tagsByEmail.get(sender) || "").trim();
        const criteria = tag ? { from: sender, subject: tag } : { from: sender };
        const uids = await client.search(criteria, { uid: true });
        if (!uids || uids.length === 0) continue;
        const searchResult: any[] = [];
        for await (const msg of client.fetch(uids, { envelope: true, internalDate: true, flags: true }, { uid: true })) {
          searchResult.push(msg);
        }

        if (searchResult.length > 0) {
          const items: FoundMessage[] = searchResult.map(msg => ({
            uid: msg.uid,
            messageId: msg.envelope?.messageId || `unknown-${msg.uid}`,
            inReplyTo: msg.envelope?.inReplyTo || null,
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
  const senderTags = new Map<string, string>();
  for (const a of accounts) if (a.warmupFilterTag) senderTags.set(a.email, String(a.warmupFilterTag));
  for (const s of seeds) if (s.filterTag) senderTags.set(s.email, String(s.filterTag));
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
      const inboxResults = await searchFolderForSenders(client, "INBOX", senderEmails, senderTags);

      for (const [senderEmail, msgs] of inboxResults) {
        const scope = logScopeFor(senderEmail);
        if (!scope) continue;
        const senderId = "senderMailboxId" in scope ? scope.senderMailboxId : scope.senderInboxId;
        const settings = senderSettings.get(senderId);
        const openRate = settings?.openRate ?? 100;

        for (const msg of msgs) {
          const log = await matchLogForMessage(msg, {
            ...scope,
            seedMailboxId: account.id,
          });

          if (!log) continue;
          if (!log.sentAt) continue;

          // Human inbox-checking gap: this email is only "opened" at a fixed
          // simulated check-time well after the sender fired, so the mailbox's
          // received/read activity lands hours apart from its own sends.
          const openAt = new Date(log.sentAt.getTime() + openDelayMinutes(log.id) * 60_000);
          if (Date.now() < openAt.getTime()) continue;

          if (shouldApply(openRate)) {
            if (settings?.readEmulation) {
              const delayMs = 5000 + Math.random() * 55000;
              await new Promise(r => setTimeout(r, delayMs));
            }

            const data: any = { receivedAt: openAt, status: "delivered" };
            const markImportant = settings?.markImportant ?? 0;
            if (shouldApply(markImportant)) {
              data.markedImportant = true;
            }

            await prisma.warmupLog.update({
              where: { id: log.id },
              data,
            });
            received++;
            await markSeen(client, "INBOX", [msg.uid]);

            const replyRate = settings?.replyRate ?? 30;
            if (shouldApply(replyRate) && msg.messageId && !log.repliedAt && account.smtpHost && account.smtpPort && account.smtpUser && account.smtpPass) {
              const replyDelay = 30000 + Math.random() * 150000;
              await new Promise(r => setTimeout(r, replyDelay));

              const replySent = await sendSeedReply(
                { email: account.email, smtpHost: account.smtpHost!, smtpPort: account.smtpPort!, smtpUser: account.smtpUser!, smtpPass: account.smtpPass! },
                senderEmail,
                log.subject || "Warmup",
                msg.messageId,
                log.bodyPreview,
                account.displayName,
                nameFromEmail(senderEmail),
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
        const spamResults = await searchFolderForSenders(client, spamFolder, senderEmails, senderTags);

        for (const [senderEmail, msgs] of spamResults) {
          const scope = logScopeFor(senderEmail);
          if (!scope) continue;
          const senderId = "senderMailboxId" in scope ? scope.senderMailboxId : scope.senderInboxId;
          const settings = senderSettings.get(senderId);
          const spamProtection = settings?.spamProtection ?? 100;

          for (const msg of msgs) {
            const log = await matchLogForMessage(msg, {
              ...scope,
              seedMailboxId: account.id,
              foundInSpam: false,
            });

            if (!log) continue;

            // Rescue while the spam window is short (20-90min): pull from junk
            // promptly, but still stamp the received time at a simulated
            // check-time so the account's timeline shows human gaps.
            if (!log.sentAt) continue;
            const openAt = new Date(log.sentAt.getTime() + openDelayMinutes(log.id, 20, 90) * 60_000);
            if (Date.now() < openAt.getTime()) continue;

            const updateData: any = { foundInSpam: true };

            if (shouldApply(spamProtection)) {
              await markSeen(client, spamFolder, [msg.uid]);
              try {
                const lock = await client.getMailboxLock(spamFolder);
                try {
                  await client.messageCopy([msg.uid], "INBOX", { uid: true });
                  await client.messageDelete([msg.uid], { uid: true });
                } finally {
                  lock.release();
                }
              } catch {
                try {
                  const lock = await client.getMailboxLock(spamFolder);
                  try {
                    await client.messageCopy([msg.uid], "INBOX", { uid: true });
                  } finally {
                    lock.release();
                  }
                } catch {}
              }

              updateData.receivedAt = openAt;
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
          const promoResults = await searchFolderForSenders(client, promoFolder, senderEmails, senderTags);

          for (const [senderEmail, msgs] of promoResults) {
            const scope = logScopeFor(senderEmail);
            if (!scope) continue;

            for (const msg of msgs) {
              const log = await matchLogForMessage(msg, {
                ...scope,
                seedMailboxId: account.id,
                foundInSpam: false,
              });

              if (!log) continue;

              // Same short rescue window as spam: pull from Promotions promptly
              // but stamp a simulated received time for human-looking gaps.
              if (!log.sentAt) continue;
              const openAt = new Date(log.sentAt.getTime() + openDelayMinutes(log.id, 20, 90) * 60_000);
              if (Date.now() < openAt.getTime()) continue;

              try {
                const lock = await client.getMailboxLock(promoFolder);
                try {
                  await client.messageFlagsAdd([msg.uid], ["\\Seen"], { uid: true });
                  await client.messageMove([msg.uid], "INBOX", { uid: true });
                } finally {
                  lock.release();
                }

                await prisma.warmupLog.update({
                  where: { id: log.id },
                  data: {
                    receivedAt: openAt,
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
