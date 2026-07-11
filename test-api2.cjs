const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const http = require('http');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(__dirname, './dev.db') });
const p = new PrismaClient({ adapter });
p.session.findFirst().then(session => {
  console.log('Session found:', session?.id, 'Token:', session?.sessionToken?.substring(0, 20) + '...');
  return session?.sessionToken;
}).then(async (token) => {
  if (!token) {
    console.log('No session found, trying without auth...');
    token = '';
  }
  const data = JSON.stringify({
    leads: [{ email: 'apitest-' + Date.now() + '@example.com' }]
  });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads/import',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': 'next-auth.session-token=' + token
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
        resolve();
      });
    });
    req.on('error', (e) => { console.error('Error:', e.message); reject(e); });
    req.write(data);
    req.end();
  });
}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
