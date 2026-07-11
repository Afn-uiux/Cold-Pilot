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
    userId: 'test-user',
  }
}).then(r => {
  console.log('Created:', r.id, r.email);
  return p.lead.findMany({ where: { email } });
}).then(leads => {
  console.log('Found:', leads.length);
  return p.lead.deleteMany({ where: { email } });
}).then(r => {
  console.log('Deleted:', r.count);
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  if (e.meta) console.error('Meta:', JSON.stringify(e.meta));
  process.exit(1);
});
