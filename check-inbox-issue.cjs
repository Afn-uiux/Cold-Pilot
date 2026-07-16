require('dotenv/config');
const {PrismaClient} = require('@prisma/client');
const {PrismaBetterSqlite3} = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const absolutePath = path.resolve(__dirname, 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const p = new PrismaClient({ adapter });

(async () => {
  // All campaigns
  const campaigns = await p.campaign.findMany({ select: { id: true, name: true, status: true } });
  console.log('=== Campaigns ===');
  campaigns.forEach(c => console.log(`  ${c.name} | status=${c.status} | id=${c.id}`));

  // All leads grouped by status
  const allLeads = await p.lead.findMany({ select: { id: true, email: true, status: true, campaignId: true } });
  console.log('\n=== All leads (' + allLeads.length + ') ===');
  const byStatus = {};
  allLeads.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
  console.log('  By status:', JSON.stringify(byStatus));
  allLeads.forEach(l => console.log(`  ${l.email} | status=${l.status} | campaign=${l.campaignId}`));

  // All incoming logs
  const incoming = await p.emailLog.findMany({ where: { type: 'incoming' }, orderBy: { sentAt: 'desc' } });
  console.log('\n=== Incoming logs (' + incoming.length + ') ===');
  incoming.forEach(l => console.log(`  leadId=${l.leadId} | subject=${l.subject} | sentAt=${l.sentAt}`));

  // All reply notifications
  const notifs = await p.notification.findMany({ where: { type: 'reply' }, orderBy: { createdAt: 'desc' } });
  console.log('\n=== Reply notifications (' + notifs.length + ') ===');
  notifs.forEach(n => console.log(`  ${n.message} | link=${n.link} | created=${n.createdAt}`));

  // Check: for each lead, does it have email logs?
  const leadIds = allLeads.map(l => l.id);
  const logs = await p.emailLog.findMany({ where: { leadId: { in: leadIds } }, orderBy: { sentAt: 'desc' } });
  const latestByLead = new Map();
  for (const log of logs) {
    if (!latestByLead.has(log.leadId)) latestByLead.set(log.leadId, log);
  }
  console.log('\n=== Leads with email logs: ' + latestByLead.size + ' / ' + leadIds.length + ' ===');

  // For replied leads, show the thread detail
  const replied = allLeads.filter(l => l.status === 'replied');
  console.log('\n=== Replied leads detail ===');
  for (const l of replied) {
    const latest = latestByLead.get(l.id);
    const leadLogs = logs.filter(ll => ll.leadId === l.id);
    console.log(`  ${l.email}: ${leadLogs.length} logs, latest type=${latest?.type}, latest sentAt=${latest?.sentAt}`);
  }

  await p.$disconnect();
})();
