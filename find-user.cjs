const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(__dirname, './dev.db') });
const p = new PrismaClient({ adapter });
p.user.findFirst().then(u => {
  if (u) console.log('User ID:', u.id, 'Email:', u.email);
  else console.log('No users found');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
