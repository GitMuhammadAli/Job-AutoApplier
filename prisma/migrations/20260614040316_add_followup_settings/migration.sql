-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpDelayDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "maxFollowUpsPerApp" INTEGER NOT NULL DEFAULT 2;
