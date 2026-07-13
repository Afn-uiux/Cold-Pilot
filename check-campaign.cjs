const d = require('better-sqlite3')('dev.db');

// Check ALL email logs, not just campaign ones
const allLogs = d.prepare("SELECT type, status, repliedAt, leadId FROM EmailLog ORDER BY sentAt").all();
console.log("=== ALL EMAIL LOGS (no filter) ===");
console.log(JSON.stringify(allLogs, null, 2));

const sent = allLogs.filter(e => e.status === "sent" || e.status === "delivered").length;
const replied = allLogs.filter(e => e.repliedAt).length;
console.log(`\nTotal sent: ${sent}, Total replied with repliedAt: ${replied}, Rate: ${sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0}%`);

// Check all leads across all campaigns
const leads = d.prepare("SELECT l.id, l.email, l.status, l.campaignId, c.name as campaignName FROM Lead l LEFT JOIN Campaign c ON l.campaignId = c.id").all();
console.log("\n=== ALL LEADS ===");
console.log(JSON.stringify(leads, null, 2));

// Check stats route filter
const campaignIds = d.prepare("SELECT id FROM Campaign WHERE userId = 'cmr4tq9ld0000rov6k8rcysvj'").all().map(r => r.id);
console.log("\n=== Campaign IDs for user ===", campaignIds);

const logsInUserCampaigns = d.prepare("SELECT e.type, e.status, e.repliedAt FROM EmailLog e JOIN Lead l ON e.leadId = l.id WHERE l.campaignId IN (" + campaignIds.map(() => "?").join(",") + ")").all(...campaignIds);
console.log("\n=== Logs in user campaigns ===", JSON.stringify(logsInUserCampaigns, null, 2));
const sent2 = logsInUserCampaigns.filter(e => e.status === "sent" || e.status === "delivered").length;
const replied2 = logsInUserCampaigns.filter(e => e.repliedAt).length;
console.log(`Rate in user campaigns: sent=${sent2}, replied=${replied2}, rate=${sent2 > 0 ? Math.round((replied2 / sent2) * 1000) / 10 : 0}%`);

d.close();
