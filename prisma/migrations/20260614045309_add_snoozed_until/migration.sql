-- AlterTable
ALTER TABLE "UserJob" ADD COLUMN "snoozedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserJob_userId_snoozedUntil_idx" ON "UserJob"("userId", "snoozedUntil");
