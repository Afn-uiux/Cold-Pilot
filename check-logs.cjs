const Database = require('better-sqlite3');
const db = new Database('dev.db');
const rows = db.prepare("SELECT id, messageId, threadId, status, leadId, sentAt, subject FROM EmailLog WHERE type='outgoing' ORDER BY sentAt DESC LIMIT 10").all();
console.log(JSON.stringify(rows, null, 2));
db.close();
