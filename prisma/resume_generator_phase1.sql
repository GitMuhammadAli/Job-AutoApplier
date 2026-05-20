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

-- CreateIndex
CREATE UNIQUE INDEX "ResumeProfile_userId_key" ON "ResumeProfile"("userId");
-- CreateIndex
CREATE INDEX "ResumeSummary_profileId_idx" ON "ResumeSummary"("profileId");
-- CreateIndex
CREATE INDEX "ResumeExperience_profileId_order_idx" ON "ResumeExperience"("profileId", "order");
-- CreateIndex
CREATE INDEX "ResumeProject_profileId_order_idx" ON "ResumeProject"("profileId", "order");
-- CreateIndex
CREATE INDEX "ResumeProject_profileId_isFeatured_idx" ON "ResumeProject"("profileId", "isFeatured");
-- CreateIndex
CREATE INDEX "ResumeEducation_profileId_order_idx" ON "ResumeEducation"("profileId", "order");
-- CreateIndex
CREATE INDEX "ResumeCertification_profileId_order_idx" ON "ResumeCertification"("profileId", "order");
-- CreateIndex
CREATE INDEX "ResumeVariant_profileId_idx" ON "ResumeVariant"("profileId");
-- CreateIndex
CREATE INDEX "ResumeGeneration_profileId_createdAt_idx" ON "ResumeGeneration"("profileId", "createdAt");
-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_resumeGenerationId_fkey" FOREIGN KEY ("resumeGenerationId") REFERENCES "ResumeGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeProfile" ADD CONSTRAINT "ResumeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeSummary" ADD CONSTRAINT "ResumeSummary_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeExperience" ADD CONSTRAINT "ResumeExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeProject" ADD CONSTRAINT "ResumeProject_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeEducation" ADD CONSTRAINT "ResumeEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeCertification" ADD CONSTRAINT "ResumeCertification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeVariant" ADD CONSTRAINT "ResumeVariant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeGeneration" ADD CONSTRAINT "ResumeGeneration_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ResumeGeneration" ADD CONSTRAINT "ResumeGeneration_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ResumeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── JobApplication: add nullable forward-compat column for Phase 3 ───
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "resumeGenerationId" TEXT;
ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_resumeGenerationId_fkey"
  FOREIGN KEY ("resumeGenerationId") REFERENCES "ResumeGeneration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
