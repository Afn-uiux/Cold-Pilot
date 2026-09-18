-- Add user's free (signup) credit reserve so purchased credits survive trial expiry
ALTER TABLE "User" ADD COLUMN "freeCreditReserve" REAL NOT NULL DEFAULT 0;

-- Mark campaigns auto-paused for lack of credits so they resume on the next purchase
ALTER TABLE "Campaign" ADD COLUMN "resumeOnFunding" BOOLEAN NOT NULL DEFAULT false;