-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "completedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSource" TEXT,
    "onboardingWebsite" TEXT,
    "onboardingGoals" TEXT,
    "totpSecret" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "leadLimitOverride" INTEGER,
    "billingCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freeCreditReserve" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signupCreditsGranted" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "planExpiresAt" TIMESTAMP(3),
    "planReminderSentDays" INTEGER NOT NULL DEFAULT 0,
    "lastBillingVisitAt" TIMESTAMP(3),
    "billingFollowUpSentAt" TIMESTAMP(3),
    "founderWelcomeSentAt" TIMESTAMP(3),
    "founderTrialExpiringSentAt" TIMESTAMP(3),
    "founderTrialExpiredSentAt" TIMESTAMP(3),
    "onboardingNudgesSent" INTEGER NOT NULL DEFAULT 0,
    "bachsCustomerId" TEXT,
    "bachsSubscriptionId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trialVoided" BOOLEAN NOT NULL DEFAULT false,
    "trialVoidReason" TEXT,
    "trialVoidedAt" TIMESTAMP(3),
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFlags" TEXT NOT NULL DEFAULT '[]',
    "riskStatus" TEXT NOT NULL DEFAULT 'none',
    "deviceFingerprint" TEXT,
    "signupIp" TEXT,
    "signupCountry" TEXT,
    "signupSource" TEXT,
    "signupReferrer" TEXT,
    "signupUtmSource" TEXT,
    "signupUtmMedium" TEXT,
    "signupUtmCampaign" TEXT,
    "signupUserAgent" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstSeenUserId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConnectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "disconnectCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MailboxIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprint" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedSignal" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
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
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "healthState" TEXT NOT NULL DEFAULT 'healthy',
    "warmupBounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warmupBounceFlag" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "warmupWeek" INTEGER NOT NULL DEFAULT 1,
    "currentDailyVolume" INTEGER NOT NULL DEFAULT 5,
    "targetDailyVolume" INTEGER NOT NULL DEFAULT 50,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 30,
    "warmupStartedAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastSentUid" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupLog" (
    "id" TEXT NOT NULL,
    "senderMailboxId" TEXT,
    "senderInboxId" TEXT,
    "seedMailboxId" TEXT,
    "seedInboxId" TEXT,
    "messageId" TEXT,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "bodyHtml" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "foundInSpam" BOOLEAN NOT NULL DEFAULT false,
    "rescuedFromSpam" BOOLEAN NOT NULL DEFAULT false,
    "markedImportant" BOOLEAN NOT NULL DEFAULT false,
    "replyReceived" BOOLEAN NOT NULL DEFAULT false,
    "bounceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmupLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupContent" (
    "id" TEXT NOT NULL,
    "senderMailboxId" TEXT NOT NULL,
    "seedMailboxId" TEXT,
    "seedInboxId" TEXT,
    "contentHash" TEXT NOT NULL,
    "subjectPreview" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "contentSource" TEXT NOT NULL DEFAULT 'templates',
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmupContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "accountIds" TEXT NOT NULL DEFAULT '[]',
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "openTracking" BOOLEAN NOT NULL DEFAULT false,
    "clickTracking" BOOLEAN NOT NULL DEFAULT false,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 30,
    "slowRamp" BOOLEAN NOT NULL DEFAULT false,
    "rampStart" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "noEndDate" BOOLEAN NOT NULL DEFAULT true,
    "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
    "plainTextOnly" BOOLEAN NOT NULL DEFAULT false,
    "firstEmailPlainText" BOOLEAN NOT NULL DEFAULT false,
    "crmOwner" TEXT NOT NULL DEFAULT '',
    "customTags" TEXT NOT NULL DEFAULT '[]',
    "minTimeBetween" INTEGER NOT NULL DEFAULT 15,
    "randomExtraTime" INTEGER NOT NULL DEFAULT 9,
    "maxNewLeads" INTEGER,
    "prioritizeNewLeads" BOOLEAN NOT NULL DEFAULT false,
    "providerMatching" BOOLEAN NOT NULL DEFAULT false,
    "espRouting" BOOLEAN NOT NULL DEFAULT false,
    "stopOnCompanyReply" BOOLEAN NOT NULL DEFAULT false,
    "stopOnAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribeHeader" BOOLEAN NOT NULL DEFAULT true,
    "enableRiskyEmails" BOOLEAN NOT NULL DEFAULT false,
    "disableBounceProtect" BOOLEAN NOT NULL DEFAULT false,
    "ccAddresses" TEXT NOT NULL DEFAULT '',
    "bccAddresses" TEXT NOT NULL DEFAULT '',
    "nextAllowedSendAt" TIMESTAMP(3),
    "resumeOnFunding" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSchedule" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New schedule',
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "days" TEXT NOT NULL DEFAULT '[true,true,true,true,true,false,false]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "delayDays" INTEGER,
    "delayUnit" TEXT NOT NULL DEFAULT 'days',
    "conditions" TEXT,
    "templateId" TEXT,

    CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "personalization" TEXT,
    "website" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "sendingAccountId" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "notes" TEXT,
    "customFields" TEXT,
    "verificationStatus" TEXT,
    "verificationReason" TEXT,
    "provider" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignStepId" TEXT,
    "emailAccountId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "threadId" TEXT,
    "messageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "error" TEXT,
    "bounceCategory" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'interested',
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "config" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '["open","click","reply","bounce"]',
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'read',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainReputation" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBouncedAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BounceEvent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "errorCode" TEXT,
    "bounceType" TEXT NOT NULL,
    "reason" TEXT,
    "emailAccountId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BounceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerLock" (
    "key" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BachsWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BachsWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "plan" TEXT,
    "subscriptionId" TEXT,
    "providerEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalLeadIntel" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalLeadIntel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedInbox" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'other',
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapUser" TEXT,
    "imapPass" TEXT,
    "gmailToken" TEXT,
    "microsoftToken" TEXT,
    "microsoftRefreshToken" TEXT,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "filterTag" TEXT NOT NULL DEFAULT '',
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "healthState" TEXT NOT NULL DEFAULT 'healthy',
    "lastUsedAt" TIMESTAMP(3),
    "note" TEXT,
    "dailyTarget" INTEGER NOT NULL DEFAULT 10,
    "warmupBase" INTEGER NOT NULL DEFAULT 2,
    "warmupIncrease" INTEGER NOT NULL DEFAULT 2,
    "warmupStartedAt" TIMESTAMP(3),
    "scheduleStart" TEXT NOT NULL DEFAULT '09:00',
    "scheduleEnd" TEXT NOT NULL DEFAULT '17:00',
    "minWaitMinutes" INTEGER NOT NULL DEFAULT 10,
    "replyRate" INTEGER NOT NULL DEFAULT 75,
    "openRate" INTEGER NOT NULL DEFAULT 100,
    "spamProtection" INTEGER NOT NULL DEFAULT 100,
    "markImportant" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'waitlist',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "byAdmin" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSettings" (
    "userId" TEXT NOT NULL,
    "aiDisabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "MailboxIdentity_firstSeenUserId_idx" ON "MailboxIdentity"("firstSeenUserId");

-- CreateIndex
CREATE INDEX "MailboxIdentity_email_idx" ON "MailboxIdentity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxIdentity_provider_providerAccountId_key" ON "MailboxIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "SignupSignal_deviceFingerprint_idx" ON "SignupSignal"("deviceFingerprint");

-- CreateIndex
CREATE INDEX "SignupSignal_ip_idx" ON "SignupSignal"("ip");

-- CreateIndex
CREATE INDEX "BlockedSignal_type_idx" ON "BlockedSignal"("type");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedSignal_type_value_key" ON "BlockedSignal"("type", "value");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_idx" ON "LoginAttempt"("email");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_idx" ON "LoginAttempt"("ip");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_sid_key" ON "UserSession"("sid");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "WarmupContent_senderMailboxId_idx" ON "WarmupContent"("senderMailboxId");

-- CreateIndex
CREATE UNIQUE INDEX "WarmupContent_senderMailboxId_seedMailboxId_contentHash_key" ON "WarmupContent"("senderMailboxId", "seedMailboxId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "WarmupContent_senderMailboxId_seedInboxId_contentHash_key" ON "WarmupContent"("senderMailboxId", "seedInboxId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_provider_key" ON "Integration"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Suppression_userId_email_key" ON "Suppression"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "DomainReputation_domain_key" ON "DomainReputation"("domain");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "BachsWebhookEvent_processedAt_idx" ON "BachsWebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_providerEventId_key" ON "PaymentEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_userId_idx" ON "PaymentEvent"("userId");

-- CreateIndex
CREATE INDEX "PaymentEvent_type_idx" ON "PaymentEvent"("type");

-- CreateIndex
CREATE INDEX "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalLeadIntel_email_key" ON "GlobalLeadIntel"("email");

-- CreateIndex
CREATE INDEX "GlobalLeadIntel_expiresAt_idx" ON "GlobalLeadIntel"("expiresAt");

-- CreateIndex
CREATE INDEX "GlobalLeadIntel_reason_idx" ON "GlobalLeadIntel"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "SeedInbox_email_key" ON "SeedInbox"("email");

-- CreateIndex
CREATE INDEX "SeedInbox_status_idx" ON "SeedInbox"("status");

-- CreateIndex
CREATE INDEX "SeedInbox_email_idx" ON "SeedInbox"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "MailboxIdentity" ADD CONSTRAINT "MailboxIdentity_firstSeenUserId_fkey" FOREIGN KEY ("firstSeenUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupSignal" ADD CONSTRAINT "SignupSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_senderMailboxId_fkey" FOREIGN KEY ("senderMailboxId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_senderInboxId_fkey" FOREIGN KEY ("senderInboxId") REFERENCES "SeedInbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_seedMailboxId_fkey" FOREIGN KEY ("seedMailboxId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_seedInboxId_fkey" FOREIGN KEY ("seedInboxId") REFERENCES "SeedInbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupContent" ADD CONSTRAINT "WarmupContent_senderMailboxId_fkey" FOREIGN KEY ("senderMailboxId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupContent" ADD CONSTRAINT "WarmupContent_seedMailboxId_fkey" FOREIGN KEY ("seedMailboxId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupContent" ADD CONSTRAINT "WarmupContent_seedInboxId_fkey" FOREIGN KEY ("seedInboxId") REFERENCES "SeedInbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSchedule" ADD CONSTRAINT "CampaignSchedule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BounceEvent" ADD CONSTRAINT "BounceEvent_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BounceEvent" ADD CONSTRAINT "BounceEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSettings" ADD CONSTRAINT "ChatSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
