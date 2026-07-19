import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

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
  seed: { email: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string },
  toEmail: string,
  originalSubject: string,
  originalMessageId: string,
): Promise<boolean> {
  const subject = originalSubject.toLowerCase().startsWith("re:")
    ? originalSubject
    : `Re: ${originalSubject}`;

  const body = randomReplyBody();

  try {
    const transporter = nodemailer.createTransport({
      host: seed.smtpHost,
      port: seed.smtpPort,
      secure: seed.smtpPort === 465,
      auth: { user: seed.smtpUser, pass: seed.smtpPass },
    });

    const info = await transporter.sendMail({
      from: seed.email,
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
    console.error(`Seed reply failed from ${seed.email}:`, err);
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

async function connectToSeed(seed: {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
}) {
  const client = new ImapFlow({
    host: seed.imapHost,
    port: seed.imapPort,
    secure: true,
    auth: { user: seed.imapUser, pass: seed.imapPass },
    logger: false,
  });
  await client.connect();
  return client;
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
        const searchResult: any[] = [];
        for await (const msg of client.fetch(`FROM "${sender}"`, { uid: true, envelope: true, internalDate: true })) {
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
  const seeds = await prisma.seedMailbox.findMany({
    where: { isActive: true },
  });

  const senders = await prisma.emailAccount.findMany({
    where: { status: "active" },
    select: { id: true, email: true, readEmulation: true, warmupOpenRate: true, warmupSpamProtection: true, warmupMarkImportant: true, warmupReplyRate: true },
  });
  const senderEmails = senders.map(s => s.email);
  const senderIdByEmail = new Map(senders.map(s => [s.email, s.id]));
  const senderSettings = new Map(senders.map(s => [s.id, { openRate: s.warmupOpenRate ?? 100, spamProtection: s.warmupSpamProtection ?? 100, markImportant: s.warmupMarkImportant ?? 0, readEmulation: s.readEmulation ?? false, replyRate: s.warmupReplyRate ?? 30 }]));

  let received = 0;
  let replied = 0;
  let rescued = 0;

  for (const seed of seeds) {
    let client: ImapFlow | null = null;

    try {
      const provider = seed.provider || providerFromEmail(seed.email);
      client = await connectToSeed(seed);

      // 1. Check INBOX for warmup emails
      const inboxResults = await searchFolderForSenders(client, "INBOX", senderEmails);

      for (const [senderEmail, msgs] of inboxResults) {
        const senderId = senderIdByEmail.get(senderEmail);
        if (!senderId) continue;
        const settings = senderSettings.get(senderId);
        const openRate = settings?.openRate ?? 100;

        for (const msg of msgs) {
          // Find matching warmup log
          const log = await prisma.warmupLog.findFirst({
            where: {
              senderMailboxId: senderId,
              seedMailboxId: seed.id,
              status: "sent",
              receivedAt: null,
            },
            orderBy: { sentAt: "desc" },
          });

          if (log && shouldApply(openRate)) {
            // Read emulation: add human-like delay before processing
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
            await prisma.seedMailbox.update({
              where: { id: seed.id },
              data: { emailsReceivedTotal: { increment: 1 } },
            });
            received++;

            // Reply from seed to sender account
            const replyRate = settings?.replyRate ?? 30;
            if (shouldApply(replyRate) && msg.messageId && !log.repliedAt) {
              // Random delay before replying (30s - 3min)
              const replyDelay = 30000 + Math.random() * 150000;
              await new Promise(r => setTimeout(r, replyDelay));

              const replied = await sendSeedReply(
                { email: seed.email, smtpHost: seed.smtpHost, smtpPort: seed.smtpPort, smtpUser: seed.smtpUser, smtpPass: seed.smtpPass },
                senderEmail,
                log.subject || "Warmup",
                msg.messageId,
              );

              if (replied) {
                await prisma.warmupLog.update({
                  where: { id: log.id },
                  data: { repliedAt: new Date(), replyReceived: true },
                });
                await prisma.seedMailbox.update({
                  where: { id: seed.id },
                  data: { repliesSentTotal: { increment: 1 } },
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
          const senderId = senderIdByEmail.get(senderEmail);
          if (!senderId) continue;
          const settings = senderSettings.get(senderId);
          const spamProtection = settings?.spamProtection ?? 100;

          for (const msg of msgs) {
            const log = await prisma.warmupLog.findFirst({
              where: {
                senderMailboxId: senderId,
                seedMailboxId: seed.id,
                status: "sent",
                foundInSpam: false,
              },
              orderBy: { sentAt: "desc" },
            });

            if (!log) continue;

            // Always mark foundInSpam even if not rescued
            const updateData: any = {
              foundInSpam: true,
            };

            if (shouldApply(spamProtection)) {
              // Copy to INBOX
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

              await prisma.seedMailbox.update({
                where: { id: seed.id },
                data: {
                  emailsReceivedTotal: { increment: 1 },
                  spamRescuesTotal: { increment: 1 },
                },
              });
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
            const senderId = senderIdByEmail.get(senderEmail);
            if (!senderId) continue;

            for (const msg of msgs) {
              const log = await prisma.warmupLog.findFirst({
                where: {
                  senderMailboxId: senderId,
                  seedMailboxId: seed.id,
                  status: "sent",
                  foundInSpam: false,
                },
                orderBy: { sentAt: "desc" },
              });

              if (!log) continue;

              // Move from Promotions to INBOX
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
                await prisma.seedMailbox.update({
                  where: { id: seed.id },
                  data: { emailsReceivedTotal: { increment: 1 } },
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

      await client.logout();
    } catch (err) {
      console.error(`IMAP processing failed for seed ${seed.email}:`, err);
    } finally {
      if (client) {
        try { await client.logout(); } catch {}
      }
    }
  }

  return { received, replied, rescued };
}
