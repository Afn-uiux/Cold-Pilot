const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.campaign.findMany({ select: { id: true, name: true, status: true, nextAllowedSendAt: true, createdAt: true } })
  .then(c => { console.log(JSON.stringify(c, null, 2)); p.$disconnect(); });
