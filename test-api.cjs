const http = require('http');
const data = JSON.stringify({
  leads: [{ email: 'apitest@example.com' }]
});
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/leads/import',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Cookie': '' // no auth - checking if we get 401
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    process.exit(0);
  });
});
req.on('error', (e) => { console.error('Error:', e.message); process.exit(1); });
req.write(data);
req.end();
