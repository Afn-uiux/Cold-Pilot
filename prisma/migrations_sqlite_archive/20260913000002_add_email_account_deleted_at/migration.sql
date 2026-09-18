-- Soft-delete for EmailAccount so admin can see connected account history
ALTER TABLE "EmailAccount" ADD COLUMN "deletedAt" DATETIME;