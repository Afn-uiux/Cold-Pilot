const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { id: true, email: true } });
  console.log('users:', JSON.stringify(users));
  for (const u of users) {
    const accounts = await p.emailAccount.findMany({ where: { userId: u.id }, select: { id: true, email: true, provider: true } });
    console.log(`accounts for ${u.email}:`, JSON.stringify(accounts));
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
