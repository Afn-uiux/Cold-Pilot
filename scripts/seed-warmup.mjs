import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
const adapter = new PrismaPg(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  const accounts = await prisma.emailAccount.findMany({ take: 5 });
  if (accounts.length < 2) {
    console.log("Need at least 2 email accounts. Create more first.");
    return;
  }

  const account = accounts[0];
  const partner = accounts[1];
  console.log(`Seeding warmup data: ${account.email} -> ${partner.email}`);

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
        seedMailboxId: partner.id,
        subject: `Warmup email ${j + 1}`,
        status: j < received ? "delivered" : "sent",
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
