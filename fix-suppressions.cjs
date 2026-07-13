const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'dev.db'));

// Clear all suppressions so leads can be retried
const deleted = db.prepare("DELETE FROM Suppression").run();
console.log('Deleted suppressions:', deleted.changes);

// Reset the 4 suppressed leads back to pending
const leads = db.prepare("UPDATE Lead SET status = 'pending', currentStep = 0 WHERE status = 'sent' AND campaignId = 'cmrh58hch00156wv6kb5cl1u7'").run();
console.log('Reset leads:', leads.changes);

// Check email account port
const acc = db.prepare("SELECT id, email, smtpHost, smtpPort FROM EmailAccount").all();
console.log('Email accounts:', acc);

db.close();
