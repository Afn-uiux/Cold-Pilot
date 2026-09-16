-- Per-user lead-limit override honored only while the free trial is live.
ALTER TABLE "User" ADD COLUMN "leadLimitOverride" INTEGER;