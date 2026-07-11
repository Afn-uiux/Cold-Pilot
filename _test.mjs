import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbUrl = 'file:./dev.db';
const relativePath = dbUrl.replace('file:', '');
const absolutePath = path.resolve(__dirname, relativePath);
console.log('DB path:', absolutePath);

const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter });

async function main() {
  const campaignIdFilter = 'cmr4trbd60001rov65cjl91eq';
  const userId = 'cmr4tq9ld0000rov6k8rcysvj';

  const campaigns = await prisma.campaign.findMany({
    where: { userId, id: campaignIdFilter },
    select: { id: true, name: true, status: true, conversionValue: true, _count: { select: { leads: true } } },
  });
  console.log('Campaigns found:', campaigns.length);

  const allSteps = await prisma.campaignStep.findMany({
    where: { campaign: { userId, id: campaignIdFilter } },
    orderBy: [{ campaignId: 'asc' }, { order: 'asc' }],
  });
  console.log('Steps found:', allSteps.length);
  if (allSteps.length > 0) {
    console.log('First step:', JSON.stringify({ id: allSteps[0].id, order: allSteps[0].order, type: allSteps[0].type }));
  }
}
main().catch(e => console.error('Error:', e.message, e.stack)).finally(() => prisma.$disconnect());
