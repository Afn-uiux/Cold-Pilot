import { ImapFlow } from "imapflow";
import { createImapClient } from "@/lib/imap-client";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptAccount } from "@/lib/crypto";
import { assertSafeMailTarget } from "@/lib/ssrf";
import { openImap } from "@/lib/oauth-connect";
import { runConcurrent } from "@/lib/concurrency";
import { openDelayMinutes } from "./open-delay";
import { buildWarmupReplyBody, nameFromEmail } from "./reply";
import { saveHealthLog, saveSeedHealthLog } from "./health";

// Seed engagement engine: makes platform-owned seed inboxes behave like real,
// live mailboxes. Seeds RECEIVE warmup (from user mailboxes and other seeds),
// mark as delivered/important, rescue from spam, and REPLY back to the sender.

const SPAM_FOLDERS: Record<string, string[]> = {
  gmail: ["[Gmail]/Spam", "Spam"],
  outlook: ["Junk", "Junk Email"],
  yahoo: ["Spam", "Bulk Mail", "Bulk"],
  proton: ["Spam"],
  other: ["Spam", "Bulk Mail", "Bulk", "Junk", "Junk Email"],
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

// Only ever trust a provider label that names a real mail provider; anything
// else (IMAP fallback strings, consumer labels) is a mislabel and the mailbox
// domain is authoritative for folder naming.
function normalizeProvider(provider: string | null | undefined, email: string): string {
  const known = new Set(["gmail", "outlook", "hotmail", "live", "yahoo", "proton"]);
  const stored = (provider || "").toLowerCase();
  return known.has(stored) ? stored : providerFromEmail(email);
}

function shouldApply(percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return Math.random() * 100 < percent;
}

async function connect(account: { imapHost: string; imapPort: number; imapUser: string; imapPass: string }) {
  // SSRF guard: imapHost/imapPort come from user-configured account settings.
  await assertSafeMailTarget(account.imapHost, account.imapPort, "IMAP");
  const client = createImapClient({
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
    try {
      return await connect({
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

async function searchFolder(client: ImapFlow, folder: string, senderEmails: string[], tagsByEmail: Map<string, string>) {
  const results = new Map<string, FoundMessage[]>();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      for (const sender of senderEmails) {
        // Identify warmup mail precisely: sender's filter tag is stamped into
        // the subject of every warmup they send (seedContent/reconciler), so
        // require it before treating a message as warmup. Some providers
        // (Yahoo) ignore the subject criterion in IMAP SEARCH, so search by
        // from only and re-apply the tag check locally on the envelope. A
        // message must carry a known warmup tag to reach the matcher — a real
        // spam email from the same sender can't accidentally match a log.
        const tag = (tagsByEmail.get(sender) || "").trim();
        const knownTags = [...tagsByEmail.values()].map(t => String(t).trim()).filter(Boolean);
        const uids = await client.search({ from: sender }, { uid: true });
        if (!uids || uids.length === 0) continue;
        const list: any[] = [];
        for await (const msg of client.fetch(uids, { envelope: true, internalDate: true, flags: true }, { uid: true })) {
          const subject = ((msg.envelope?.subject || "") as string).toLowerCase();
          // A reply to one of OUR warmups carries the tag of whoever we sent
          // from (this mailbox), not the replier's own tag — so don't require
          // the sender tag for a threaded reply; the inReplyTo → parent-log
          // match is the actual gate and can't be spoofed by real spam.
          const isReply = !!msg.envelope?.inReplyTo;
          const matchesSenderTag = tag ? subject.includes(tag.toLowerCase()) : true;
          const matchesAnyKnownTag = knownTags.some(kt => subject.includes(kt.toLowerCase()));
          if ((matchesSenderTag && matchesAnyKnownTag) || isReply) list.push(msg);
        }
        if (list.length > 0) {
          results.set(sender, list.map(m => ({
            uid: m.uid,
            messageId: m.envelope?.messageId || `unknown-${m.uid}`,
            inReplyTo: m.envelope?.inReplyTo || null,
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

// Pair a physical inbox message to ITS warmup log by Message-ID (exact), skip
// replies to already-delivered warmup threads, and only fall back to the
// oldest-unread log for genuinely unknown mail. `where` pins the receiver to
// this seed (and the sender) — see call sites.
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

// Bind a physical spam-folder message to a warmup log even when the log was
// already marked delivered/rescued. The DB saying "rescued" while the message
// is STILL physically in spam is proof the old code's move failed — but it
// recorded the result anyway and the strict matcher above will never touch a
// delivered log. Exact Message-ID only, so a real third-party email can't be
// hijacked into a recovery.
async function matchStuckSpamLog(msg: FoundMessage, where: Record<string, unknown>): Promise<any> {
  const mid = msg.messageId && !msg.messageId.startsWith("unknown-") ? msg.messageId : null;
  if (!mid) return null;
  return prisma.warmupLog.findFirst({
    where: { ...where, messageId: mid },
    orderBy: { sentAt: "desc" },
  });
}

// Bind a spam-folder REPLY to the warmup THREAD it belongs to. Replies aren't
// logged individually — only the original send is — so the strict matcher can
// never find them, and their subject carries the tag of whoever we sent FROM
// (this mailbox), not the replier's. Bind by In-Reply-To -> the parent log
// where THIS mailbox was the sender. A real spam message can't reference the
// random Message-ID we generated for our own warmup, so the match is safe.
async function matchReplyLog(msg: FoundMessage, ownIds: { seedId?: string; mailboxId?: string }): Promise<any> {
  const ref = msg.inReplyTo || "";
  const mid = ref.replace(/^<|>$/g, "").trim();
  if (!mid) return null;
  const anchor = ownIds.seedId
    ? { senderInboxId: ownIds.seedId }
    : { senderMailboxId: ownIds.mailboxId };
  return prisma.warmupLog.findFirst({
    where: { ...anchor, messageId: ref },
    orderBy: { sentAt: "desc" },
  });
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
    select: { email: true, warmupFilterTag: true },
  });
  const senderEmails = [
    ...userAccounts.map(a => a.email),
    ...seeds.map(s => s.email),
  ];
  const senderTags = new Map<string, string>();
  for (const a of userAccounts) if (a.warmupFilterTag) senderTags.set(a.email, String(a.warmupFilterTag));
  for (const s of seeds) if (s.filterTag) senderTags.set(s.email, String(s.filterTag));

  let received = 0;
  let replied = 0;
  let rescued = 0;

  // Senders whose warmup landed in this seed's spam during this pass. The
  // sender can be a user mailbox (senderMailboxId) or another seed
  // (senderInboxId) — recompute whichever sent the flagged warmup.
  const sendersToRefresh = new Map<string, "mailbox" | "seed">();

  // Seed inboxes are fully independent — each opens its own IMAP connection,
  // matches warmup logs verbatim under `seedInboxId: seed.id`, and replies
  // with its own SMTP creds. Scanning them concurrently (capped) keeps the
  // IMAP + AI-reply wait from eating the whole scheduler tick as the seed
  // network grows.
  await runConcurrent(seeds, async (seed) => {
    let client: ImapFlow | null = null;
    try {
      const provider = normalizeProvider(seed.provider, seed.email);
      client = await connectForRead(seed);
      if (!client) return;

      // Match a sender email to the warmup log that used THIS seed as receiver.
      function logWhere(senderEmail: string, senderIsUser: boolean) {
        if (senderIsUser) {
          return { seedInboxId: seed.id, senderMailbox: { email: senderEmail } };
        }
        // Sender is another seed (network self-warm) — match by seed sender.
        return { seedInboxId: seed.id, senderInbox: { email: senderEmail } };
      }

      // INBOX: mark delivered / reply
      const inbox = await searchFolder(client, "INBOX", senderEmails, senderTags);
      for (const [senderEmail, msgs] of inbox) {
        const senderIsUser = userAccounts.some(a => a.email === senderEmail);
        for (const msg of msgs) {
          const log = await matchLogForMessage(msg, logWhere(senderEmail, senderIsUser));
          if (!log) continue;
          if (!log.sentAt) continue;

          // Human inbox-checking gap: this email is only "opened" at a fixed
          // simulated check-time well after the sender fired, so the mailbox's
          // received/read activity lands hours apart from its own sends.
          const openAt = new Date(log.sentAt.getTime() + openDelayMinutes(log.id) * 60_000);
          if (Date.now() < openAt.getTime()) continue;

          const data: any = { receivedAt: openAt, status: "delivered" };
          if (shouldApply(seed.markImportant ?? 10)) data.markedImportant = true;
          await prisma.warmupLog.update({ where: { id: log.id }, data });
          received++;
          await markSeen(client, "INBOX", [msg.uid]);

          if (!log.repliedAt && seed.smtpHost && seed.smtpPort && seed.smtpUser && seed.smtpPass && msg.messageId && shouldApply(seed.replyRate ?? 75)) {
            await new Promise(r => setTimeout(r, 30000 + Math.random() * 150000));
            const ok = await sendSeedReply(
              { email: seed.email, smtpHost: seed.smtpHost, smtpPort: seed.smtpPort, smtpUser: seed.smtpUser, smtpPass: seed.smtpPass },
              senderEmail,
              log.subject || "Warmup",
              msg.messageId,
              log.bodyPreview,
              seed.displayName,
              nameFromEmail(senderEmail),
            );
            if (ok) {
              await prisma.warmupLog.update({ where: { id: log.id }, data: { repliedAt: new Date(), replyReceived: true } });
              replied++;
            }
          }
        }
      }

      // Spam/Promotions: rescue to INBOX. A rescuing function taking the live
      // connection so a stale/dead one from the INBOX pass can be swapped and
      // this pass still runs — spam rescue must not silently die with INBOX.
      const spamFolders = [...getSpamFolders(provider), "[Gmail]/Promotions", "Promotions"];
      const rescue = async (c: ImapFlow) => {
        for (const folder of spamFolders) {
          const found = await searchFolder(c, folder, senderEmails, senderTags);
          for (const [senderEmail, msgs] of found) {
            const senderIsUser = userAccounts.some(a => a.email === senderEmail);
            for (const msg of msgs) {
              // Strict match first: only an unresolved log (status sent, not
              // yet received) gets the normal spam-protection rescue.
              let log = await matchLogForMessage(msg, logWhere(senderEmail, senderIsUser));
              // Recovery: log already marked delivered/rescued but the message
              // is STILL physically in the spam folder — the old code recorded
              // a rescue it never completed. Bind by exact Message-ID and
              // physically move it to INBOX.
              if (!log) {
                log = await matchStuckSpamLog(msg, logWhere(senderEmail, senderIsUser));
              }
              // Replies aren't logged individually, so neither matcher above can
              // bind them. Their In-Reply-To points at OUR outbound warmup that
              // the replier is answering — rescue the stranded reply itself.
              if (!log) {
                log = await matchReplyLog(msg, { seedId: seed.id });
              }
              if (!log) continue;
              const isReplyRescue = log.senderInboxId === seed.id;
              // Short rescue window (20-90min): pull from junk promptly while
              // still stamping a simulated received time for human-looking gaps.
              // Stuck-but-delivered logs skip straight to physical cleanup.
              let openAt = new Date();
              const notYetDelivered = log.status !== "delivered" && !log.receivedAt;
              if (notYetDelivered) {
                if (!log.sentAt) continue;
                openAt = new Date(log.sentAt.getTime() + openDelayMinutes(log.id, 20, 90) * 60_000);
                if (Date.now() < openAt.getTime()) continue;
              }

              // Second chance: the strict+stuck matchers above only know logs
              // where THIS seed is the receiver. A REPLY to our own outbound
              // warmup (sender = this seed) has no log of its own, so its
              // In-Reply-To is used to find the thread. Rescue it physically.
              if (isReplyRescue) {
                try {
                  await markSeen(c, folder, [msg.uid]);
                  const lock = await c.getMailboxLock(folder);
                  try {
                    const moved = await c.messageMove([msg.uid], "INBOX", { uid: true });
                    if (!moved) throw new Error("messageMove returned false");
                  } finally {
                    lock.release();
                  }
                  rescued++;
                  console.log(`Recovered spam reply for ${seed.email}: UID ${msg.uid} moved from ${folder} to INBOX (thread ${log.messageId})`);
                } catch (err) {
                  console.error(`Spam-reply recovery failed for ${seed.email}, ${folder}, UID ${msg.uid}:`, err);
                }
                continue;
              }

              // This warmup landed in junk — a placement hit for its sender.
              if (log.senderMailboxId) sendersToRefresh.set(log.senderMailboxId, "mailbox");
              else if (log.senderInboxId) sendersToRefresh.set(log.senderInboxId, "seed");

              // DB says delivered but the message is physically still in spam:
              // move the real copy to INBOX and drop the spam stray.
              if (!notYetDelivered) {
                try {
                  await markSeen(c, folder, [msg.uid]);
                  const lock = await c.getMailboxLock(folder);
                  try {
                    const moved = await c.messageMove([msg.uid], "INBOX", { uid: true });
                    if (!moved) throw new Error("messageMove returned false");
                  } finally {
                    lock.release();
                  }
                  rescued++;
                  console.log(`Recovered stuck spam for ${seed.email}: UID ${msg.uid} moved from ${folder} to INBOX`);
                  await prisma.warmupLog.update({
                    where: { id: log.id },
                    data: { foundInSpam: true },
                  });
                } catch (err) {
                  console.error(`Stuck-spam recovery failed for ${seed.email}, ${folder}, UID ${msg.uid}:`, err);
                }
                continue;
              }

              // Always record that this warmup landed in junk; whether we pull it
              // back out depends on the seed's spam-protection rate.
              if (shouldApply(seed.spamProtection ?? 100)) {
                let moved = false;
                try {
                  const lock = await c.getMailboxLock(folder);
                  try {
                    await c.messageFlagsAdd([msg.uid], ["\\Seen"], { uid: true });
                    await c.messageCopy([msg.uid], "INBOX", { uid: true });
                    moved = true; // copy to INBOX landed; deletion is best-effort
                    await c.messageDelete([msg.uid], { uid: true }).catch(() => {});
                  } finally {
                    lock.release();
                  }
                } catch (err) {
                  console.error(`Seed spam rescue failed for ${seed.email}, ${folder}, UID ${msg.uid}:`, err);
                }
                if (moved) {
                  await prisma.warmupLog.update({
                    where: { id: log.id },
                    data: { foundInSpam: true, rescuedFromSpam: true, receivedAt: openAt, status: "delivered" },
                  });
                  rescued++;
                } else {
                  await prisma.warmupLog.update({
                    where: { id: log.id },
                    data: { foundInSpam: true },
                  });
                }
              } else {
                await prisma.warmupLog.update({
                  where: { id: log.id },
                  data: { foundInSpam: true },
                });
              }
            }
          }
        }
      };

      // Run the rescue pass on the live connection; if the link went stale
      // (socket timeout during INBOX or connect) reconnect once so spam is
      // still scanned for every seed this tick.
      if (client.usable) await rescue(client);
      if (!client.usable) {
        console.warn(`Connection went stale for ${seed.email}, reconnecting for spam pass`);
        const retry = await connectForRead(seed);
        if (retry) {
          try { await client.logout(); } catch {}
          client = retry;
          await rescue(client);
        }
      }
    } catch (err) {
      console.error(`Seed engagement failed for ${seed.email}:`, err);
    } finally {
      if (client) { try { await client.logout(); } catch {} }
    }
  });

  // Immediately reflect spam landings in the senders' stored health scores.
  await Promise.all([...sendersToRefresh].map(async ([senderId, kind]) => {
    try {
      if (kind === "mailbox") await saveHealthLog(senderId);
      else await saveSeedHealthLog(senderId);
    } catch {
      // Health recompute is best-effort; failures must not fail the pass.
    }
  }));

  return { received, replied, rescued };
}
