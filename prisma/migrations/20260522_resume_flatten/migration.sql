-- Migration: flatten resume generator schema
--
-- Rationale: ResumeProfile was a header hub duplicating UserSettings fields;
-- ResumeVariant overlapped with ResumeGeneration. Drop both; rewire child
-- tables (Summary/Experience/Project/Education/Certification/Generation) to
-- userId directly. Header data now sources from UserSettings + User at
-- render-time.
--
-- Pre-flight: confirmed zero rows in ResumeProfile, ResumeVariant, and all
-- child tables (see migration tooling output). No data movement required.
--
-- Reversibility: tables can be re-created from a prior schema.prisma; row
-- data is permanently lost (was empty). Down-migration SQL is in the comment
-- block at the bottom of this file for emergency rollback.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Add resume-specific columns to UserSettings (the new home for header data)
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "resumeHeadline"     TEXT,
  ADD COLUMN IF NOT EXISTS "resumeSkills"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "resumeSkillsLocked" BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop foreign keys that pointed at ResumeProfile / ResumeVariant
ALTER TABLE "ResumeSummary"       DROP CONSTRAINT IF EXISTS "ResumeSummary_profileId_fkey";
ALTER TABLE "ResumeExperience"    DROP CONSTRAINT IF EXISTS "ResumeExperience_profileId_fkey";
ALTER TABLE "ResumeProject"       DROP CONSTRAINT IF EXISTS "ResumeProject_profileId_fkey";
ALTER TABLE "ResumeEducation"     DROP CONSTRAINT IF EXISTS "ResumeEducation_profileId_fkey";
ALTER TABLE "ResumeCertification" DROP CONSTRAINT IF EXISTS "ResumeCertification_profileId_fkey";
ALTER TABLE "ResumeGeneration"    DROP CONSTRAINT IF EXISTS "ResumeGeneration_profileId_fkey";
ALTER TABLE "ResumeGeneration"    DROP CONSTRAINT IF EXISTS "ResumeGeneration_variantId_fkey";
ALTER TABLE "ResumeVariant"       DROP CONSTRAINT IF EXISTS "ResumeVariant_profileId_fkey";
ALTER TABLE "ResumeProfile"       DROP CONSTRAINT IF EXISTS "ResumeProfile_userId_fkey";

-- 3. Drop indexes that referenced profileId
DROP INDEX IF EXISTS "ResumeSummary_profileId_idx";
DROP INDEX IF EXISTS "ResumeExperience_profileId_order_idx";
DROP INDEX IF EXISTS "ResumeProject_profileId_order_idx";
DROP INDEX IF EXISTS "ResumeProject_profileId_isFeatured_idx";
DROP INDEX IF EXISTS "ResumeEducation_profileId_order_idx";
DROP INDEX IF EXISTS "ResumeCertification_profileId_order_idx";
DROP INDEX IF EXISTS "ResumeGeneration_profileId_createdAt_idx";
DROP INDEX IF EXISTS "ResumeVariant_profileId_idx";
DROP INDEX IF EXISTS "ResumeProfile_userId_key";

-- 4. ResumeSummary: profileId → userId
ALTER TABLE "ResumeSummary" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "ResumeSummary" ADD  COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "ResumeSummary"
  ADD CONSTRAINT "ResumeSummary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeSummary_userId_idx" ON "ResumeSummary"("userId");

-- 5. ResumeExperience: profileId → userId
ALTER TABLE "ResumeExperience" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "ResumeExperience" ADD  COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "ResumeExperience"
  ADD CONSTRAINT "ResumeExperience_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeExperience_userId_order_idx" ON "ResumeExperience"("userId", "order");

-- 6. ResumeProject: profileId → userId
ALTER TABLE "ResumeProject" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "ResumeProject" ADD  COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "ResumeProject"
  ADD CONSTRAINT "ResumeProject_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeProject_userId_order_idx"      ON "ResumeProject"("userId", "order");
CREATE INDEX "ResumeProject_userId_isFeatured_idx" ON "ResumeProject"("userId", "isFeatured");

-- 7. ResumeEducation: profileId → userId
ALTER TABLE "ResumeEducation" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "ResumeEducation" ADD  COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "ResumeEducation"
  ADD CONSTRAINT "ResumeEducation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeEducation_userId_order_idx" ON "ResumeEducation"("userId", "order");

-- 8. ResumeCertification: profileId → userId
ALTER TABLE "ResumeCertification" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "ResumeCertification" ADD  COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "ResumeCertification"
  ADD CONSTRAINT "ResumeCertification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeCertification_userId_order_idx" ON "ResumeCertification"("userId", "order");

-- 9. ResumeGeneration: drop profileId + variantId, add userId, name, isFavorite
ALTER TABLE "ResumeGeneration" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "ResumeGeneration" DROP COLUMN IF EXISTS "variantId";
ALTER TABLE "ResumeGeneration" ADD  COLUMN "userId"     TEXT NOT NULL;
ALTER TABLE "ResumeGeneration" ADD  COLUMN "name"       TEXT;
ALTER TABLE "ResumeGeneration" ADD  COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ResumeGeneration"
  ADD CONSTRAINT "ResumeGeneration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeGeneration_userId_createdAt_idx" ON "ResumeGeneration"("userId", "createdAt");
CREATE INDEX "ResumeGeneration_userId_isFavorite_idx" ON "ResumeGeneration"("userId", "isFavorite");

-- 10. Drop ResumeVariant and ResumeProfile
DROP TABLE IF EXISTS "ResumeVariant";
DROP TABLE IF EXISTS "ResumeProfile";

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN MIGRATION (manual rollback — restore prior schema)
-- ─────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- CREATE TABLE "ResumeProfile" (
--   id TEXT PRIMARY KEY, userId TEXT UNIQUE NOT NULL, fullName TEXT NOT NULL,
--   headline TEXT NOT NULL, location TEXT, email TEXT NOT NULL, phone TEXT,
--   websiteUrl TEXT, githubUrl TEXT, linkedinUrl TEXT, skills TEXT[],
--   "skillsLocked" BOOLEAN DEFAULT false, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP
-- );
-- CREATE TABLE "ResumeVariant" (
--   id TEXT PRIMARY KEY, "profileId" TEXT NOT NULL, name TEXT NOT NULL,
--   "templateId" TEXT NOT NULL, "templateVersion" TEXT NOT NULL, "pageTarget" INT DEFAULT 1,
--   "skillsOrder" TEXT[], "projectIds" TEXT[], "experienceIds" TEXT[],
--   "summaryId" TEXT, "sectionOrder" TEXT[], "isDefault" BOOLEAN DEFAULT false,
--   "generatedFromJd" BOOLEAN DEFAULT false, "jdSnippet" TEXT,
--   "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP
-- );
-- ALTER TABLE "ResumeSummary"       ADD COLUMN "profileId" TEXT NOT NULL, DROP COLUMN "userId";
-- ALTER TABLE "ResumeExperience"    ADD COLUMN "profileId" TEXT NOT NULL, DROP COLUMN "userId";
-- ALTER TABLE "ResumeProject"       ADD COLUMN "profileId" TEXT NOT NULL, DROP COLUMN "userId";
-- ALTER TABLE "ResumeEducation"     ADD COLUMN "profileId" TEXT NOT NULL, DROP COLUMN "userId";
-- ALTER TABLE "ResumeCertification" ADD COLUMN "profileId" TEXT NOT NULL, DROP COLUMN "userId";
-- ALTER TABLE "ResumeGeneration"    ADD COLUMN "profileId" TEXT NOT NULL, DROP COLUMN "userId",
--                                   DROP COLUMN "name", DROP COLUMN "isFavorite";
-- ALTER TABLE "UserSettings" DROP COLUMN "resumeSkills", DROP COLUMN "resumeSkillsLocked",
--                            DROP COLUMN "resumeHeadline";
-- -- (Plus re-add all FKs + indexes pointing at profileId. Empty rows = no data loss.)
-- COMMIT;
