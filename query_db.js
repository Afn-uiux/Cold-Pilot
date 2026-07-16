const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const absolutePath = path.resolve('C:/Users/user/Documents/coldpilot/dev.db');
const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter });

async function queryMode() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd === 'status') {
    const campaigns = await prisma.campaign.findMany({ select: { id: true, name: true, status: true, deletedAt: true } });
    console.log('=== CAMPAIGNS ===');
    for (const c of campaigns) console.log(`  ${c.name} status=${c.status} deletedAt=${c.deletedAt}`);
    const leads = await prisma.lead.findMany({ select: { id: true, email: true, status: true, deletedAt: true, campaignId: true } });
    console.log('\n=== LEADS ===');
    for (const l of leads) console.log(`  ${l.email} status=${l.status} campaign=${l.campaignId} deletedAt=${l.deletedAt}`);
    const logs = await prisma.emailLog.findMany({ select: { id: true, type: true, status: true, leadId: true } });
    console.log(`\n=== EMAIL LOGS (${logs.length}) ===`);
    for (const l of logs) console.log(`  type=${l.type} status=${l.status} lead=${l.leadId}`);
    const sups = await prisma.suppression.findMany({ select: { email: true, reason: true } });
    console.log(`\n=== SUPPRESSIONS (${sups.length}) ===`);
    for (const s of sups) console.log(`  ${s.email} reason=${s.reason}`);
  } else if (cmd === 'sql') {
    const sql = args.slice(1).join(' ');
    const result = await prisma.$queryRawUnsafe(sql);
    for (const row of result) {
      const vals = Object.values(row).map(v => v === null ? 'NULL' : String(v)).join(' | ');
      console.log(`  ${vals}`);
    }
  } else {
    const accounts = await prisma.emailAccount.findMany({
      select: { id: true, email: true, displayName: true, provider: true, status: true },
    });
    console.log('=== EMAIL ACCOUNTS ===');
    for (const a of accounts) {
      console.log(`  id=${a.id} email=${a.email} displayName="${a.displayName}" provider=${a.provider} status=${a.status}`);
    }
  }
  await prisma.$disconnect();
}

async function fixNames() {
  await prisma.emailAccount.updateMany({ where: { email: 'gbengaa40@yahoo.com' }, data: { displayName: 'Gbenga Awoyinka' } });
  await prisma.emailAccount.updateMany({ where: { email: 'deefave183@gmail.com' }, data: { displayName: 'Dee Fave' } });
  console.log('Display names updated.');
  const accounts = await prisma.emailAccount.findMany({
    select: { id: true, email: true, displayName: true },
  });
  for (const a of accounts) {
    console.log(`  ${a.email}: displayName="${a.displayName}"`);
  }
  await prisma.$disconnect();
}

async function cleanupOrphans() {
  const archivedCampaignIds = (await prisma.campaign.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  })).map(c => c.id);

  if (archivedCampaignIds.length === 0) {
    console.log('No archived campaigns found.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${archivedCampaignIds.length} archived campaigns.`);

  for (const cid of archivedCampaignIds) {
    const leads = await prisma.lead.findMany({
      where: { campaignId: cid, deletedAt: null },
      select: { id: true, _count: { select: { deals: true, groups: true } } },
    });
    const toSoftDelete = leads.filter(l => l._count.deals === 0 && l._count.groups === 0).map(l => l.id);
    const toDetach = leads.filter(l => l._count.deals > 0 || l._count.groups > 0).map(l => l.id);

    if (toSoftDelete.length > 0) {
      await prisma.lead.updateMany({ where: { id: { in: toSoftDelete } }, data: { deletedAt: new Date() } });
    }
    if (toDetach.length > 0) {
      await prisma.lead.updateMany({ where: { id: { in: toDetach } }, data: { campaignId: null } });
    }
    console.log(`  ${cid}: soft-deleted ${toSoftDelete.length}, detached ${toDetach.length}`);
  }

  // Also delete email logs for orphaned leads
  const orphanLogs = await prisma.emailLog.deleteMany({
    where: { lead: { campaignId: { in: archivedCampaignIds } } },
  });
  console.log(`Deleted ${orphanLogs.count} email logs for archived campaigns.`);

  await prisma.$disconnect();
}

const cmd = process.argv[2];
if (cmd === 'fix-names') {
  fixNames().catch(e => { console.error(e); process.exit(1); });
} else if (cmd === 'cleanup') {
  cleanupOrphans().catch(e => { console.error(e); process.exit(1); });
} else {
  queryMode().catch(e => { console.error(e); process.exit(1); });
}
