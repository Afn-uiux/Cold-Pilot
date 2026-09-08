-- AddTable columns for one-time plan expiry (flush in plan-expiry sweep)
ALTER TABLE "User" ADD COLUMN "planExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "planReminderSentDays" INTEGER NOT NULL DEFAULT 0;