-- Add missing columns from schema drift
ALTER TABLE Campaign ADD COLUMN "accountIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE CampaignStep ADD COLUMN "delayUnit" TEXT NOT NULL DEFAULT 'days';
ALTER TABLE EmailLog ADD COLUMN "clickedAt" DATETIME;

-- Add tracking preferences and conversion value to Campaign
ALTER TABLE Campaign ADD COLUMN "openTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE Campaign ADD COLUMN "clickTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE Campaign ADD COLUMN "conversionValue" REAL NOT NULL DEFAULT 0;
