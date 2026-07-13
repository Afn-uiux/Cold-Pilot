const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const adapter = new PrismaBetterSqlite3({ url: path.resolve(__dirname, './dev.db') });
const p = new PrismaClient({ adapter });

(async () => {
  // Get active campaign with all settings
  const camp = await p.campaign.findFirst({
    where: { status: 'active' },
    select: {
      id: true, name: true, status: true, openTracking: true, clickTracking: true,
      minTimeBetween: true, randomExtraTime: true, stopOnReply: true, stopOnAutoReply: true,
      nextAllowedSendAt: true, dailySendLimit: true, accountIds: true, slowRamp: true,
    }
  });
  console.log('ACTIVE CAMPAIGN:', JSON.stringify(camp, null, 2));

  // Get steps
  const steps = await p.campaignStep.findMany({
    where: { campaignId: camp?.id },
    orderBy: { order: 'asc' }
  });
  console.log('STEPS:');
  for (const s of steps) {
    console.log(`  Step ${s.order + 1}: subject="${(s.subject||'').slice(0,50)}" delay=${s.delayDays}${s.delayUnit} bodyLen=${(s.bodyHtml||'').length}`);
  }

  // Get all email logs for this campaign
  const logs = await p.emailLog.findMany({
    where: { lead: { campaignId: camp?.id } },
    orderBy: { sentAt: 'asc' },
    select: { id: true, leadId: true, status: true, type: true, sentAt: true, campaignStepId: true, error: true }
  });
  console.log('EMAIL LOGS (' + logs.length + '):');
  for (const l of logs) {
    console.log(`  [${l.status}] type=${l.type} step=${l.campaignStepId?.slice(-4)} sent=${l.sentAt} err=${l.error || 'none'}`);
  }

  // Get leads for this campaign
  const leads = await p.lead.findMany({
    where: { campaignId: camp?.id },
    select: { id: true, email: true, status: true, currentStep: true, lastSentAt: true }
  });
  console.log('LEADS (' + leads.length + '):');
  for (const l of leads) {
    console.log(`  ${l.email} status=${l.status} step=${l.currentStep} lastSent=${l.lastSentAt}`);
  }

  // Notifications
  const notifs = await p.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('NOTIFICATIONS:', notifs.length);
  for (const n of notifs) {
    console.log(`  [${n.type}] ${n.title}: ${n.message}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
