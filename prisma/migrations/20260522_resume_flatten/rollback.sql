-- Rollback for 20260522_resume_flatten
--
-- OPERATOR ESCAPE HATCH — not run by `prisma migrate deploy` (Prisma's runner
-- only executes `migration.sql`). Apply manually if the flatten needs to be
-- reversed:
--     psql "$DATABASE_URL" -f prisma/migrations/20260522_resume_flatten/rollback.sql
--
-- Caveat: row data inside ResumeProfile/ResumeVariant is unrecoverable from
-- here — the forward migration dropped both tables. This rollback restores
-- empty tables + re-wires the child-table FKs back to profileId. After
-- running this, also restore the pre-flatten schema.prisma and run
-- `prisma generate` so the Prisma client matches the DB shape again.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Recreate ResumeProfile
CREATE TABLE "ResumeProfile" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL UNIQUE,
  "fullName"     TEXT NOT NULL,
  "headline"     TEXT NOT NULL,
  "location"     TEXT,
  "email"        TEXT NOT NULL,
  "phone"        TEXT,
  "websiteUrl"   TEXT,
  "githubUrl"    TEXT,
  "linkedinUrl"  TEXT,
  "skills"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skillsLocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "ResumeProfile"
  ADD CONSTRAINT "ResumeProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Recreate ResumeVariant
CREATE TABLE "ResumeVariant" (
  "id"               TEXT PRIMARY KEY,
  "profileId"        TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "templateId"       TEXT NOT NULL,
  "templateVersion"  TEXT NOT NULL,
  "pageTarget"       INT NOT NULL DEFAULT 1,
  "skillsOrder"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "projectIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "experienceIds"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summaryId"        TEXT,
  "sectionOrder"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isDefault"        BOOLEAN NOT NULL DEFAULT false,
  "generatedFromJd"  BOOLEAN NOT NULL DEFAULT false,
  "jdSnippet"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "ResumeVariant"
  ADD CONSTRAINT "ResumeVariant_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeVariant_profileId_idx" ON "ResumeVariant"("profileId");

-- 3. ResumeSummary: userId → profileId
ALTER TABLE "ResumeSummary" DROP CONSTRAINT IF EXISTS "ResumeSummary_userId_fkey";
DROP INDEX IF EXISTS "ResumeSummary_userId_idx";
ALTER TABLE "ResumeSummary" DROP COLUMN "userId";
ALTER TABLE "ResumeSummary" ADD  COLUMN "profileId" TEXT NOT NULL;
ALTER TABLE "ResumeSummary"
  ADD CONSTRAINT "ResumeSummary_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeSummary_profileId_idx" ON "ResumeSummary"("profileId");

-- 4. ResumeExperience: userId → profileId
ALTER TABLE "ResumeExperience" DROP CONSTRAINT IF EXISTS "ResumeExperience_userId_fkey";
DROP INDEX IF EXISTS "ResumeExperience_userId_order_idx";
ALTER TABLE "ResumeExperience" DROP COLUMN "userId";
ALTER TABLE "ResumeExperience" ADD  COLUMN "profileId" TEXT NOT NULL;
ALTER TABLE "ResumeExperience"
  ADD CONSTRAINT "ResumeExperience_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeExperience_profileId_order_idx" ON "ResumeExperience"("profileId", "order");

-- 5. ResumeProject: userId → profileId
ALTER TABLE "ResumeProject" DROP CONSTRAINT IF EXISTS "ResumeProject_userId_fkey";
DROP INDEX IF EXISTS "ResumeProject_userId_order_idx";
DROP INDEX IF EXISTS "ResumeProject_userId_isFeatured_idx";
ALTER TABLE "ResumeProject" DROP COLUMN "userId";
ALTER TABLE "ResumeProject" ADD  COLUMN "profileId" TEXT NOT NULL;
ALTER TABLE "ResumeProject"
  ADD CONSTRAINT "ResumeProject_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeProject_profileId_order_idx"      ON "ResumeProject"("profileId", "order");
CREATE INDEX "ResumeProject_profileId_isFeatured_idx" ON "ResumeProject"("profileId", "isFeatured");

-- 6. ResumeEducation: userId → profileId
ALTER TABLE "ResumeEducation" DROP CONSTRAINT IF EXISTS "ResumeEducation_userId_fkey";
DROP INDEX IF EXISTS "ResumeEducation_userId_order_idx";
ALTER TABLE "ResumeEducation" DROP COLUMN "userId";
ALTER TABLE "ResumeEducation" ADD  COLUMN "profileId" TEXT NOT NULL;
ALTER TABLE "ResumeEducation"
  ADD CONSTRAINT "ResumeEducation_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeEducation_profileId_order_idx" ON "ResumeEducation"("profileId", "order");

-- 7. ResumeCertification: userId → profileId
ALTER TABLE "ResumeCertification" DROP CONSTRAINT IF EXISTS "ResumeCertification_userId_fkey";
DROP INDEX IF EXISTS "ResumeCertification_userId_order_idx";
ALTER TABLE "ResumeCertification" DROP COLUMN "userId";
ALTER TABLE "ResumeCertification" ADD  COLUMN "profileId" TEXT NOT NULL;
ALTER TABLE "ResumeCertification"
  ADD CONSTRAINT "ResumeCertification_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResumeCertification_profileId_order_idx" ON "ResumeCertification"("profileId", "order");

-- 8. ResumeGeneration: userId/name/isFavorite → profileId + variantId
ALTER TABLE "ResumeGeneration" DROP CONSTRAINT IF EXISTS "ResumeGeneration_userId_fkey";
DROP INDEX IF EXISTS "ResumeGeneration_userId_createdAt_idx";
DROP INDEX IF EXISTS "ResumeGeneration_userId_isFavorite_idx";
ALTER TABLE "ResumeGeneration" DROP COLUMN "userId";
ALTER TABLE "ResumeGeneration" DROP COLUMN "name";
ALTER TABLE "ResumeGeneration" DROP COLUMN "isFavorite";
ALTER TABLE "ResumeGeneration" ADD  COLUMN "profileId" TEXT NOT NULL;
ALTER TABLE "ResumeGeneration" ADD  COLUMN "variantId" TEXT;
ALTER TABLE "ResumeGeneration"
  ADD CONSTRAINT "ResumeGeneration_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ResumeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeGeneration"
  ADD CONSTRAINT "ResumeGeneration_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ResumeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ResumeGeneration_profileId_createdAt_idx" ON "ResumeGeneration"("profileId", "createdAt");

-- 9. UserSettings: drop the resume header columns
ALTER TABLE "UserSettings"
  DROP COLUMN IF EXISTS "resumeHeadline",
  DROP COLUMN IF EXISTS "resumeSkills",
  DROP COLUMN IF EXISTS "resumeSkillsLocked";

COMMIT;
