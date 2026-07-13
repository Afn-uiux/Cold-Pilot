const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(__dirname, 'dev.db') });
const p = new PrismaClient({ adapter });
p.emailAccount.findMany({
  select: {
    id: true, email: true, provider: true,
    imapHost: true, imapPort: true, imapUser: true, imapPass: true,
    gmailToken: true, status: true
  }
}).then(a => {
  console.log(JSON.stringify(a, null, 2));
  p.$disconnect();
});
