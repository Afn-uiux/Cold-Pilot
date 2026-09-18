-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "plan" TEXT,
    "subscriptionId" TEXT,
    "providerEventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_providerEventId_key" ON "PaymentEvent"("providerEventId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_userId_idx" ON "PaymentEvent"("userId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_type_idx" ON "PaymentEvent"("type");
CREATE INDEX IF NOT EXISTS "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");
