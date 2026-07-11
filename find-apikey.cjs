const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(__dirname, './dev.db') });
const p = new PrismaClient({ adapter });
p.apiKey.findFirst().then(key => {
  if (key) console.log('API Key:', key.key, 'User:', key.userId);
  else console.log('No API keys found');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
