-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('STAGE_CHANGE', 'NOTE_ADDED', 'COVER_LETTER_GENERATED', 'APPLICATION_PREPARED', 'APPLICATION_SENT', 'APPLICATION_FAILED', 'APPLICATION_COPIED', 'FOLLOW_UP_SENT', 'MANUAL_UPDATE', 'DISMISSED', 'NOTIFICATION_SENT', 'APPLICATION_BOUNCED', 'APPLICATION_CANCELLED', 'FOLLOW_UP_FLAGGED');

-- CreateEnum
CREATE TYPE "ApplicationMode" AS ENUM ('SEMI_AUTO', 'FULL_AUTO', 'MANUAL', 'INSTANT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'READY', 'SENDING', 'SENT', 'FAILED', 'BOUNCED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplyMethod" AS ENUM ('EMAIL', 'MANUAL', 'PLATFORM');

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED');

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
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userJobId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyEmail" (
    "id" TEXT NOT NULL,
    "companyNorm" TEXT NOT NULL,
    "companyDisplay" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalJob" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "salary" TEXT,
    "jobType" TEXT,
    "experienceLevel" TEXT,
    "category" TEXT,
    "skills" TEXT[],
    "postedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "applyUrl" TEXT,
    "companyUrl" TEXT,
    "companyEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFresh" BOOLEAN NOT NULL DEFAULT true,
    "emailContributedBy" TEXT,
    "emailSource" TEXT,
    "emailConfidence" INTEGER,

    CONSTRAINT "GlobalJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "userJobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "resumeId" TEXT,
    "coverLetter" TEXT,
    "templateId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "appliedVia" "ApplyMethod" NOT NULL DEFAULT 'EMAIL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailConfidence" TEXT,
    "scheduledSendAt" TIMESTAMP(3),
    "followUpBody" TEXT,
    "followUpStatus" TEXT,
    "followUpSubject" TEXT,
    "resumeGenerationId" TEXT,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "content" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "detectedSkills" TEXT[],
    "targetCategories" TEXT[],
    "textQuality" TEXT DEFAULT 'good',
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeCertification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issuedDate" TEXT,
    "credentialUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeEducation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "startDate" TEXT,
    "endDate" TEXT,
    "details" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeExperience" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "bullets" TEXT[],
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeGeneration" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "variantId" TEXT,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "pageTarget" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "htmlSnapshot" TEXT,
    "jdSnippet" TEXT,
    "matchedKeywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "location" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "websiteUrl" TEXT,
    "githubUrl" TEXT,
    "linkedinUrl" TEXT,
    "skills" TEXT[],
    "skillsLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeProject" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT,
    "oneLiner" TEXT NOT NULL,
    "bullets" TEXT[],
    "stack" TEXT[],
    "liveUrl" TEXT,
    "repoUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeSummary" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVariant" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "pageTarget" INTEGER NOT NULL DEFAULT 1,
    "skillsOrder" TEXT[],
    "projectIds" TEXT[],
    "experienceIds" TEXT[],
    "summaryId" TEXT,
    "sectionOrder" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "generatedFromJd" BOOLEAN NOT NULL DEFAULT false,
    "jdSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsSaved" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "query" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "SystemLock" (
    "name" TEXT NOT NULL,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SystemLock_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "globalJobId" TEXT NOT NULL,
    "stage" "JobStage" NOT NULL DEFAULT 'SAVED',
    "matchScore" DOUBLE PRECISION,
    "matchReasons" TEXT[],
    "notes" TEXT,
    "coverLetter" TEXT,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissReason" TEXT,
    "lastFollowUpAt" TIMESTAMP(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "githubUrl" TEXT,
    "keywords" TEXT[],
    "city" TEXT,
    "country" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'USD',
    "experienceLevel" TEXT,
    "education" TEXT,
    "workType" TEXT[],
    "jobType" TEXT[],
    "languages" TEXT[],
    "preferredCategories" TEXT[],
    "preferredPlatforms" TEXT[],
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" TEXT,
    "applicationEmail" TEXT,
    "applicationMode" "ApplicationMode" NOT NULL DEFAULT 'MANUAL',
    "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxAutoApplyPerDay" INTEGER NOT NULL DEFAULT 10,
    "minMatchScoreForAutoApply" DOUBLE PRECISION NOT NULL DEFAULT 75.0,
    "defaultSignature" TEXT,
    "customSystemPrompt" TEXT,
    "preferredTone" TEXT DEFAULT 'professional',
    "emailLanguage" TEXT DEFAULT 'English',
    "includeLinkedin" BOOLEAN NOT NULL DEFAULT true,
    "includeGithub" BOOLEAN NOT NULL DEFAULT true,
    "includePortfolio" BOOLEAN NOT NULL DEFAULT true,
    "customClosing" TEXT,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instantApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "peakHoursOnly" BOOLEAN NOT NULL DEFAULT false,
    "priorityPlatforms" TEXT[],
    "timezone" TEXT DEFAULT 'Asia/Karachi',
    "emailProvider" TEXT DEFAULT 'brevo',
    "resumeMatchMode" TEXT DEFAULT 'smart',
    "smtpHost" TEXT,
    "smtpPass" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "accountStatus" TEXT DEFAULT 'active',
    "instantApplyDelay" INTEGER DEFAULT 5,
    "notificationFrequency" TEXT DEFAULT 'hourly',
    "bouncePauseHours" INTEGER NOT NULL DEFAULT 24,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastVisitedAt" TIMESTAMP(3),
    "maxSendsPerDay" INTEGER NOT NULL DEFAULT 20,
    "maxSendsPerHour" INTEGER NOT NULL DEFAULT 8,
    "sendDelaySeconds" INTEGER NOT NULL DEFAULT 120,
    "sendingPausedUntil" TIMESTAMP(3),
    "smtpVerifiedAt" TIMESTAMP(3),
    "blacklistedCompanies" TEXT[],
    "negativeKeywords" TEXT[],
    "smtpSetupDate" TIMESTAMP(3),
    "pushNotifications" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId" ASC);

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Activity_userId_type_createdAt_idx" ON "Activity"("userId" ASC, "type" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Activity_userJobId_idx" ON "Activity"("userJobId" ASC);

-- CreateIndex
CREATE INDEX "CompanyEmail_companyNorm_idx" ON "CompanyEmail"("companyNorm" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmail_companyNorm_key" ON "CompanyEmail"("companyNorm" ASC);

-- CreateIndex
CREATE INDEX "EmailTemplate_userId_idx" ON "EmailTemplate"("userId" ASC);

-- CreateIndex
CREATE INDEX "EmailTemplate_userId_isDefault_idx" ON "EmailTemplate"("userId" ASC, "isDefault" ASC);

-- CreateIndex
CREATE INDEX "GlobalJob_category_idx" ON "GlobalJob"("category" ASC);

-- CreateIndex
CREATE INDEX "GlobalJob_createdAt_idx" ON "GlobalJob"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "GlobalJob_isActive_createdAt_idx" ON "GlobalJob"("isActive" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "GlobalJob_isFresh_isActive_idx" ON "GlobalJob"("isFresh" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalJob_sourceId_source_key" ON "GlobalJob"("sourceId" ASC, "source" ASC);

-- CreateIndex
CREATE INDEX "GlobalJob_source_idx" ON "GlobalJob"("source" ASC);

-- CreateIndex
CREATE INDEX "GlobalJob_source_isActive_idx" ON "GlobalJob"("source" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "JobApplication_status_scheduledSendAt_idx" ON "JobApplication"("status" ASC, "scheduledSendAt" ASC);

-- CreateIndex
CREATE INDEX "JobApplication_userId_createdAt_idx" ON "JobApplication"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "JobApplication_userId_sentAt_idx" ON "JobApplication"("userId" ASC, "sentAt" ASC);

-- CreateIndex
CREATE INDEX "JobApplication_userId_status_idx" ON "JobApplication"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_userJobId_key" ON "JobApplication"("userJobId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId" ASC, "endpoint" ASC);

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId" ASC);

-- CreateIndex
CREATE INDEX "Resume_userId_idx" ON "Resume"("userId" ASC);

-- CreateIndex
CREATE INDEX "Resume_userId_isDeleted_idx" ON "Resume"("userId" ASC, "isDeleted" ASC);

-- CreateIndex
CREATE INDEX "ResumeCertification_profileId_order_idx" ON "ResumeCertification"("profileId" ASC, "order" ASC);

-- CreateIndex
CREATE INDEX "ResumeEducation_profileId_order_idx" ON "ResumeEducation"("profileId" ASC, "order" ASC);

-- CreateIndex
CREATE INDEX "ResumeExperience_profileId_order_idx" ON "ResumeExperience"("profileId" ASC, "order" ASC);

-- CreateIndex
CREATE INDEX "ResumeGeneration_profileId_createdAt_idx" ON "ResumeGeneration"("profileId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeProfile_userId_key" ON "ResumeProfile"("userId" ASC);

-- CreateIndex
CREATE INDEX "ResumeProject_profileId_isFeatured_idx" ON "ResumeProject"("profileId" ASC, "isFeatured" ASC);

-- CreateIndex
CREATE INDEX "ResumeProject_profileId_order_idx" ON "ResumeProject"("profileId" ASC, "order" ASC);

-- CreateIndex
CREATE INDEX "ResumeSummary_profileId_idx" ON "ResumeSummary"("profileId" ASC);

-- CreateIndex
CREATE INDEX "ResumeVariant_profileId_idx" ON "ResumeVariant"("profileId" ASC);

-- CreateIndex
CREATE INDEX "ScraperRun_source_startedAt_idx" ON "ScraperRun"("source" ASC, "startedAt" ASC);

-- CreateIndex
CREATE INDEX "ScraperRun_status_startedAt_idx" ON "ScraperRun"("status" ASC, "startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "SystemLog_source_createdAt_idx" ON "SystemLog"("source" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SystemLog_type_createdAt_idx" ON "SystemLog"("type" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SystemLog_type_source_idx" ON "SystemLog"("type" ASC, "source" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE INDEX "UserFeedback_status_createdAt_idx" ON "UserFeedback"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "UserFeedback_userId_createdAt_idx" ON "UserFeedback"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "UserJob_userId_createdAt_idx" ON "UserJob"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserJob_userId_globalJobId_key" ON "UserJob"("userId" ASC, "globalJobId" ASC);

-- CreateIndex
CREATE INDEX "UserJob_userId_isDismissed_idx" ON "UserJob"("userId" ASC, "isDismissed" ASC);

-- CreateIndex
CREATE INDEX "UserJob_userId_matchScore_idx" ON "UserJob"("userId" ASC, "matchScore" ASC);

-- CreateIndex
CREATE INDEX "UserJob_userId_stage_idx" ON "UserJob"("userId" ASC, "stage" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token" ASC);

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userJobId_fkey" FOREIGN KEY ("userJobId") REFERENCES "UserJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "UserSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_resumeGenerationId_fkey" FOREIGN KEY ("resumeGenerationId") REFERENCES "ResumeGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userJobId_fkey" FOREIGN KEY ("userJobId") REFERENCES "UserJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeCertification" ADD CONSTRAINT "ResumeCertification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeEducation" ADD CONSTRAINT "ResumeEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeExperience" ADD CONSTRAINT "ResumeExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeGeneration" ADD CONSTRAINT "ResumeGeneration_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeGeneration" ADD CONSTRAINT "ResumeGeneration_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ResumeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeProfile" ADD CONSTRAINT "ResumeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeProject" ADD CONSTRAINT "ResumeProject_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSummary" ADD CONSTRAINT "ResumeSummary_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVariant" ADD CONSTRAINT "ResumeVariant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_globalJobId_fkey" FOREIGN KEY ("globalJobId") REFERENCES "GlobalJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

