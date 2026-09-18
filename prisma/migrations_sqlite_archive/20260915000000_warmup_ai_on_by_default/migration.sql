-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapUser" TEXT,
    "imapPass" TEXT,
    "gmailClientId" TEXT,
    "gmailSecret" TEXT,
    "gmailToken" TEXT,
    "microsoftToken" TEXT,
    "microsoftRefreshToken" TEXT,
    "displayName" TEXT,
    "domain" TEXT,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "warmupBase" INTEGER NOT NULL DEFAULT 2,
    "warmupIncrease" INTEGER NOT NULL DEFAULT 2,
    "warmupMax" INTEGER NOT NULL DEFAULT 10,
    "warmupDays" INTEGER NOT NULL DEFAULT 127,
    "warmupFilterTag" TEXT NOT NULL DEFAULT '',
    "disableSlowWarmup" BOOLEAN NOT NULL DEFAULT false,
    "warmupReplyRate" INTEGER NOT NULL DEFAULT 30,
    "readEmulation" BOOLEAN NOT NULL DEFAULT false,
    "warmupOpenRate" INTEGER NOT NULL DEFAULT 100,
    "warmupSpamProtection" INTEGER NOT NULL DEFAULT 100,
    "warmupMarkImportant" INTEGER NOT NULL DEFAULT 0,
    "customTrackingDomain" TEXT NOT NULL DEFAULT '',
    "warmupCustomTrackingDomain" BOOLEAN NOT NULL DEFAULT false,
    "warmupStartTime" TEXT NOT NULL DEFAULT '08:00',
    "warmupEndTime" TEXT NOT NULL DEFAULT '17:00',
    "minWaitTime" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "warmupAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "healthScore" REAL NOT NULL DEFAULT 100,
    "healthState" TEXT NOT NULL DEFAULT 'healthy',
    "warmupBounceRate" REAL NOT NULL DEFAULT 0,
    "warmupBounceFlag" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "warmupWeek" INTEGER NOT NULL DEFAULT 1,
    "currentDailyVolume" INTEGER NOT NULL DEFAULT 5,
    "targetDailyVolume" INTEGER NOT NULL DEFAULT 50,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 30,
    "warmupStartedAt" DATETIME,
    "lastHealthCheckAt" DATETIME,
    "lastSentUid" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailAccount" ("createdAt", "currentDailyVolume", "customTrackingDomain", "dailySendLimit", "deletedAt", "disableSlowWarmup", "displayName", "domain", "email", "gmailClientId", "gmailSecret", "gmailToken", "healthScore", "healthState", "id", "imapHost", "imapPass", "imapPort", "imapUser", "isPaused", "lastHealthCheckAt", "lastSentUid", "microsoftRefreshToken", "microsoftToken", "minWaitTime", "provider", "readEmulation", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "status", "targetDailyVolume", "timezone", "updatedAt", "userId", "warmupAiEnabled", "warmupBase", "warmupBounceFlag", "warmupBounceRate", "warmupCustomTrackingDomain", "warmupDays", "warmupEnabled", "warmupEndTime", "warmupFilterTag", "warmupIncrease", "warmupMarkImportant", "warmupMax", "warmupOpenRate", "warmupReplyRate", "warmupSpamProtection", "warmupStartTime", "warmupStartedAt", "warmupWeek") SELECT "createdAt", "currentDailyVolume", "customTrackingDomain", "dailySendLimit", "deletedAt", "disableSlowWarmup", "displayName", "domain", "email", "gmailClientId", "gmailSecret", "gmailToken", "healthScore", "healthState", "id", "imapHost", "imapPass", "imapPort", "imapUser", "isPaused", "lastHealthCheckAt", "lastSentUid", "microsoftRefreshToken", "microsoftToken", "minWaitTime", "provider", "readEmulation", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "status", "targetDailyVolume", "timezone", "updatedAt", "userId", "warmupAiEnabled", "warmupBase", "warmupBounceFlag", "warmupBounceRate", "warmupCustomTrackingDomain", "warmupDays", "warmupEnabled", "warmupEndTime", "warmupFilterTag", "warmupIncrease", "warmupMarkImportant", "warmupMax", "warmupOpenRate", "warmupReplyRate", "warmupSpamProtection", "warmupStartTime", "warmupStartedAt", "warmupWeek" FROM "EmailAccount";
DROP TABLE "EmailAccount";
ALTER TABLE "new_EmailAccount" RENAME TO "EmailAccount";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: existing mailboxes get AI-generated warmup content turned on by default.
UPDATE "EmailAccount" SET "warmupAiEnabled" = 1;