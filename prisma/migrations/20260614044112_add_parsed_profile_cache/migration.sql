-- AlterTable: cache parsed structured profile + last successful parse timestamp on Resume
ALTER TABLE "Resume" ADD COLUMN "parsedProfile" JSONB, ADD COLUMN "parsedProfileAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Resume_userId_parsedProfileAt_idx" ON "Resume"("userId", "parsedProfileAt");
