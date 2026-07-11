const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const leads = await p.lead.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, firstName: true, status: true } });
  console.log('leads:', JSON.stringify(leads, null, 2));
  for (const l of leads) {
    const count = await p.emailLog.count({ where: { leadId: l.id } });
    console.log(`  logs for ${l.email}: ${count}`);
  }
  const lastLog = await p.emailLog.findFirst({ where: { type: 'outgoing' }, orderBy: { sentAt: 'desc' }, include: { lead: { select: { email: true } } } });
  console.log('last outgoing log:', JSON.stringify(lastLog ? { id: lastLog.id, leadId: lastLog.leadId, leadEmail: lastLog.lead?.email, repliedAt: lastLog.repliedAt } : null, null, 2));
  await p.$disconnect();
}
main();
