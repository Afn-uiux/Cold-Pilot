import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  const accounts = await prisma.emailAccount.findMany({ take: 5 });
  if (accounts.length === 0) {
    console.log("No email accounts found. Create one first.");
    return;
  }

  const account = accounts[0];
  console.log(`Seeding warmup data for: ${account.email} (${account.id})`);

  let seed = await prisma.seedMailbox.findFirst({ where: { email: account.email } });
  if (!seed) {
    seed = await prisma.seedMailbox.create({
      data: {
        email: account.email,
        userId: account.userId,
        smtpHost: account.smtpHost || "smtp.example.com",
        smtpPort: account.smtpPort || 587,
        smtpUser: account.smtpUser || account.email,
        smtpPass: account.smtpPass || "secret",
        imapHost: account.imapHost || "imap.example.com",
        imapPort: account.imapPort || 993,
        imapUser: account.imapUser || account.email,
        imapPass: account.imapPass || "secret",
        provider: account.provider || "other",
      },
    });
    console.log(`Created seed mailbox: ${seed.id}`);
  }

  await prisma.warmupLog.deleteMany({ where: { senderMailboxId: account.id } });

  const logs = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

    const sent = 3 + Math.floor(Math.random() * 7);
    const received = Math.floor(sent * (0.5 + Math.random() * 0.4));
    const rescued = Math.floor(received * (0.1 + Math.random() * 0.3));

    for (let j = 0; j < sent; j++) {
      const ts = new Date(d);
      ts.setMinutes(ts.getMinutes() + j * (2 + Math.floor(Math.random() * 5)));
      logs.push({
        senderMailboxId: account.id,
        seedMailboxId: seed.id,
        subject: `Warmup email ${j + 1}`,
        status: j < received ? "received" : "sent",
        sentAt: ts,
        receivedAt: j < received ? new Date(ts.getTime() + 60000 * (1 + Math.floor(Math.random() * 10))) : null,
        rescuedFromSpam: j < rescued,
        messageId: `<warmup-${Date.now()}-${j}-${i}@local>`,
      });
    }
  }

  await prisma.warmupLog.createMany({ data: logs });
  console.log(`Inserted ${logs.length} warmup logs.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
