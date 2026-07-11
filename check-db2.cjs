const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, './dev.db');
console.log('DB path:', dbPath);
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const p = new PrismaClient({ adapter });
p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").then(r => {
  console.log('Tables:', r.map(t => t.name).join(', '));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
