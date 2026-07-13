require('dotenv/config');
const {PrismaClient} = require('@prisma/client');
const {PrismaBetterSqlite3} = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const absolutePath = path.resolve(__dirname, 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const p = new PrismaClient({ adapter });

(async () => {
  // Check replied leads
  const replied = await p.lead.findMany({ where: { status: 'replied' } });
  console.log('=== Replied leads (' + replied.length + ') ===');
  replied.forEach(l => console.log(`  ${l.email} | status=${l.status} | campaignId=${l.campaignId}`));

  // Check incoming email logs
  const incoming = await p.emailLog.findMany({ where: { type: 'incoming' }, orderBy: { sentAt: 'desc' }, take: 10 });
  console.log('\n=== Incoming email logs (' + incoming.length + ') ===');
  incoming.forEach(l => console.log(`  leadId=${l.leadId} | subject=${l.subject} | sentAt=${l.sentAt}`));

  // Check deals
  const deals = await p.deal.findMany();
  console.log('\n=== Deals (' + deals.length + ') ===');
  deals.forEach(d => console.log(`  leadId=${d.leadId} | stage=${d.stage}`));

  // Check reply notifications
  const notifs = await p.notification.findMany({ where: { type: 'reply' }, orderBy: { createdAt: 'desc' }, take: 10 });
  console.log('\n=== Reply notifications (' + notifs.length + ') ===');
  notifs.forEach(n => console.log(`  ${n.title}: ${n.message} | link=${n.link}`));

  // Simulate what the inbox API does
  const allLeads = await p.lead.findMany({ where: { userId: replied[0]?.userId || '' } });
  const leadIds = allLeads.map(l => l.id);
  console.log('\n=== Total leads for user: ' + leadIds.length + ' ===');

  if (leadIds.length > 0) {
    const logs = await p.emailLog.findMany({ where: { leadId: { in: leadIds } }, orderBy: { sentAt: 'desc' } });
    const latestByLead = new Map();
    for (const log of logs) {
      if (!latestByLead.has(log.leadId)) latestByLead.set(log.leadId, log);
    }
    console.log('Leads with email logs: ' + latestByLead.size);

    const repliedLeadIds = replied.map(l => l.id);
    for (const lid of repliedLeadIds) {
      const hasLog = latestByLead.has(lid);
      const log = latestByLead.get(lid);
      console.log(`  Replied lead ${lid}: hasLog=${hasLog} | logType=${log?.type} | repliedAt=${log?.repliedAt}`);
    }
  }

  await p.$disconnect();
})();
