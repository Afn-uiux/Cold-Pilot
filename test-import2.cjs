const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(__dirname, './dev.db') });
const p = new PrismaClient({ adapter });
const email = 'test-' + Date.now() + '@example.com';
p.lead.create({
  data: {
    email,
    firstName: 'Test',
    lastName: 'User',
    company: 'TestCo',
    notes: 'test note',
    userId: 'cmr25btod0000gkv657spfk22',
  }
}).then(r => {
  console.log('Created:', r.id);
  return p.lead.findMany({ where: { userId: 'cmr25btod0000gkv657spfk22' } });
}).then(leads => {
  console.log('Total leads:', leads.length);
  return p.lead.deleteMany({ where: { email } });
}).then(r => {
  console.log('Deleted:', r.count);
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
