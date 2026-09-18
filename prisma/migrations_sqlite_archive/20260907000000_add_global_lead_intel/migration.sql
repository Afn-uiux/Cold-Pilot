-- CreateTable
CREATE TABLE IF NOT EXISTS "GlobalLeadIntel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "GlobalLeadIntel_email_key" UNIQUE ("email")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GlobalLeadIntel_expiresAt_idx" ON "GlobalLeadIntel"("expiresAt");
CREATE INDEX IF NOT EXISTS "GlobalLeadIntel_reason_idx" ON "GlobalLeadIntel"("reason");
