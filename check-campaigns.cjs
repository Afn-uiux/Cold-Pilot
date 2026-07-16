const Database = require('better-sqlite3');
const db = new Database('C:\\Users\\user\\Documents\\coldpilot\\dev.db');

// Campaigns per user
const campaigns = db.prepare("SELECT id, name, userId, status, createdAt FROM Campaign ORDER BY createdAt DESC").all();
console.log("Campaigns:");
campaigns.forEach(c => console.log(`  ${c.name} (userId: ${c.userId}, status: ${c.status}, created: ${c.createdAt})`));

// Leads per user per campaign
const leadCounts = db.prepare("SELECT userId, campaignId, COUNT(*) as cnt, status FROM Lead GROUP BY userId, campaignId, status ORDER BY userId").all();
console.log("\nLead counts by userId/campaign/status:");
leadCounts.forEach(l => console.log(`  userId=${l.userId} campaignId=${l.campaignId} status=${l.status} count=${l.cnt}`));

// Which user has the most leads?
const userLeadCounts = db.prepare("SELECT userId, COUNT(*) as cnt FROM Lead GROUP BY userId").all();
console.log("\nLeads per user:");
userLeadCounts.forEach(u => console.log(`  userId=${u.userId}: ${u.cnt} leads`));

db.close();
