CREATE TABLE "ChatSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "aiDisabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
