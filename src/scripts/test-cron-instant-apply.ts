/**
 * Standalone test: Simulates the match-all-users cron (instant-apply).
 *
 * Run:  npx tsx src/scripts/test-cron-instant-apply.ts [--dry-run]
 *       npx tsx src/scripts/test-cron-instant-apply.ts --write
 *
 * Default: dry-run (no DB writes). Use --write to simulate actual writes (still no writes in dry-run).
 *
 * Requires: DATABASE_URL, ENCRYPTION_KEY
 */

import "./test-utils";
import { prisma } from "@/lib/prisma";
import {
  header,
  subheader,
  verdict,
  pass,
  fail,
  warn,
  info,
} from "./test-utils";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { decryptSettingsFields } from "@/lib/encryption";
import { TIMEOUTS } from "@/lib/constants";

const BOX_TOP_LEFT = "┌";
const BOX_TOP_RIGHT = "┐";
const BOX_BOTTOM_LEFT = "└";
const BOX_BOTTOM_RIGHT = "┘";
const BOX_H = "─";
const BOX_V = "│";

type ApplicationMode = "MANUAL" | "SEMI_AUTO" | "FULL_AUTO";

interface UserBreakdown {
  userId: string;
  userName: string | null;
  applicationMode: ApplicationMode;
  matched: number;
  skipped: number;
  rejected: number;
  userJobsWouldCreate: number;
  draftsWouldCreate: number;
  readyWouldCreate: number;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--write");

  const startTime = Date.now();

  header("Match-All-Users Cron Simulation");
  info(`Mode: ${dryRun ? "DRY-RUN (no DB writes)" : "WRITE (would persist)"}`);
  info(`Thresholds: KANBAN=${MATCH_THRESHOLDS.SHOW_ON_KANBAN} NOTIFY=${MATCH_THRESHOLDS.NOTIFY} AUTO_DRAFT=${MATCH_THRESHOLDS.AUTO_DRAFT} AUTO_SEND=${MATCH_THRESHOLDS.AUTO_SEND}`);

  // ─── 1. Load fresh GlobalJobs ─────────────────────────────────────────────
  subheader("1. Fresh GlobalJobs");
  const freshJobs = await prisma.globalJob.findMany({
    where: { isFresh: true, isActive: true },
    take: 100,
  });
  info(`Found ${freshJobs.length} fresh jobs`);

  if (freshJobs.length === 0) {
    verdict("Verdict");
    pass("No fresh jobs to process");
    info(`Total time: ${Date.now() - startTime}ms`);
    await prisma.$disconnect();
    return;
  }

  // ─── 2. Load active users with settings ──────────────────────────────────
  subheader("2. Active users (onboarded)");
  const allSettings = await prisma.userSettings.findMany({
    where: { isOnboarded: true },
    include: { user: true },
    take: 10,
  });
  info(`Found ${allSettings.length} onboarded users`);

  const userBreakdowns: UserBreakdown[] = [];
  let totalMatched = 0;
  let totalSkipped = 0;
  let totalRejected = 0;

  // ─── 3. Process each user ─────────────────────────────────────────────────
  subheader("3. Per-user processing");

  for (const rawSettings of allSettings) {
    const settings = decryptSettingsFields(rawSettings);
    const userId = settings.userId;
    const userName = settings.user?.name ?? null;
    const applicationMode = (settings.applicationMode as ApplicationMode) ?? "SEMI_AUTO";

    const keywords = (settings.keywords as string[]) ?? [];
    const preferredCategories = (settings.preferredCategories as string[]) ?? [];
    const preferredPlatforms = (settings.preferredPlatforms as string[]) ?? [];

    const settingsForMatch = {
      keywords,
      preferredCategories,
      preferredPlatforms,
      city: settings.city ?? null,
      country: settings.country ?? null,
      experienceLevel: settings.experienceLevel ?? null,
      workType: (settings.workType as string[]) ?? [],
      jobType: (settings.jobType as string[]) ?? [],
      salaryMin: settings.salaryMin ?? null,
      salaryMax: settings.salaryMax ?? null,
    };

    const resumes = await prisma.resume.findMany({
      where: {
        userId,
        deletedAt: null,
        isDeleted: false,
      },
      select: { id: true, name: true, content: true },
    });

    if (resumes.length === 0) {
      warn(`User ${userName ?? userId}: no resumes, skipping`);
      continue;
    }

    const existingJobIds = new Set(
      (
        await prisma.userJob.findMany({
          where: { userId },
          select: { globalJobId: true },
        })
      ).map((j) => j.globalJobId),
    );

    let matched = 0;
    let skipped = 0;
    let rejected = 0;
    let userJobsWouldCreate = 0;
    let draftsWouldCreate = 0;
    let readyWouldCreate = 0;

    for (const job of freshJobs) {
      if (existingJobIds.has(job.id)) {
        skipped++;
        continue;
      }

      const jobPayload = {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        skills: (job.skills as string[]) ?? [],
        category: job.category,
        source: job.source,
        experienceLevel: job.experienceLevel,
        salary: job.salary,
        jobType: job.jobType,
        isFresh: job.isFresh,
        firstSeenAt: job.firstSeenAt,
      };

      const result = computeMatchScore(jobPayload, settingsForMatch, resumes);

      if (result.score < MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
        rejected++;
        continue;
      }

      matched++;
      userJobsWouldCreate++;

      if (applicationMode === "MANUAL") continue;

      if (result.score < MATCH_THRESHOLDS.AUTO_DRAFT) continue;

      if (applicationMode === "SEMI_AUTO") {
        draftsWouldCreate++;
      } else if (applicationMode === "FULL_AUTO") {
        if (result.score >= MATCH_THRESHOLDS.AUTO_SEND) {
          readyWouldCreate++;
        } else {
          draftsWouldCreate++;
        }
      }
    }

    totalMatched += matched;
    totalSkipped += skipped;
    totalRejected += rejected;

    userBreakdowns.push({
      userId,
      userName,
      applicationMode,
      matched,
      skipped,
      rejected,
      userJobsWouldCreate,
      draftsWouldCreate,
      readyWouldCreate,
    });
  }

  // ─── 4. Per-user breakdown (box-drawing) ──────────────────────────────────
  subheader("4. Per-user breakdown");

  for (const u of userBreakdowns) {
    const displayName = u.userName ?? u.userId.slice(0, 8) + "...";
    console.log(`\n  ${BOX_TOP_LEFT}${BOX_H.repeat(52)}${BOX_TOP_RIGHT}`);
    console.log(`  ${BOX_V} User: ${displayName.padEnd(44)} ${BOX_V}`);
    console.log(`  ${BOX_V} Mode: ${u.applicationMode.padEnd(44)} ${BOX_V}`);
    console.log(`  ${"├" + BOX_H.repeat(52) + "┤"}`);
    console.log(`  ${BOX_V} Matched: ${String(u.matched).padEnd(42)} ${BOX_V}`);
    console.log(`  ${BOX_V} Skipped (already exists): ${String(u.skipped).padEnd(28)} ${BOX_V}`);
    console.log(`  ${BOX_V} Rejected (score < ${MATCH_THRESHOLDS.SHOW_ON_KANBAN}): ${String(u.rejected).padEnd(18)} ${BOX_V}`);
    console.log(`  ${"├" + BOX_H.repeat(52) + "┤"}`);
    console.log(`  ${BOX_V} Would create UserJobs: ${String(u.userJobsWouldCreate).padEnd(28)} ${BOX_V}`);
    console.log(`  ${BOX_V} Would create DRAFT applications: ${String(u.draftsWouldCreate).padEnd(20)} ${BOX_V}`);
    console.log(`  ${BOX_V} Would create READY applications: ${String(u.readyWouldCreate).padEnd(19)} ${BOX_V}`);
    console.log(`  ${BOX_BOTTOM_LEFT}${BOX_H.repeat(52)}${BOX_BOTTOM_RIGHT}`);
  }

  // ─── 5. Totals & timing ───────────────────────────────────────────────────
  subheader("5. Totals & timing");
  const totalTimeMs = Date.now() - startTime;
  const totalTimeStr = `${totalTimeMs}ms`;
  const underTimeout = totalTimeMs < TIMEOUTS.CRON_SOFT_LIMIT_MS;

  console.log(`  ${BOX_TOP_LEFT}${BOX_H.repeat(40)}${"┬"}${BOX_H.repeat(12)}${BOX_TOP_RIGHT}`);
  console.log(`  ${BOX_V}${"Metric".padEnd(40)}${BOX_V}${"Value".padEnd(12)}${BOX_V}`);
  console.log(`  ${"├" + BOX_H.repeat(40) + "┼" + BOX_H.repeat(12) + "┤"}`);
  console.log(`  ${BOX_V}${"Fresh jobs".padEnd(40)}${BOX_V}${String(freshJobs.length).padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Users processed".padEnd(40)}${BOX_V}${String(userBreakdowns.length).padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Total matched".padEnd(40)}${BOX_V}${String(totalMatched).padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Total skipped (duplicates)".padEnd(40)}${BOX_V}${String(totalSkipped).padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Total rejected".padEnd(40)}${BOX_V}${String(totalRejected).padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Total time".padEnd(40)}${BOX_V}${String(totalTimeStr).padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_V}${"Under 8s timeout?".padEnd(40)}${BOX_V}${(underTimeout ? "Yes" : "No").padEnd(12)}${BOX_V}`);
  console.log(`  ${BOX_BOTTOM_LEFT}${BOX_H.repeat(40)}${"┴"}${BOX_H.repeat(12)}${BOX_BOTTOM_RIGHT}`);

  // ─── 6. isFresh cleanup ───────────────────────────────────────────────────
  subheader("6. isFresh cleanup");
  const freshCount = freshJobs.length;
  info(`Would mark ${freshCount} job ID(s) as isFresh=false`);

  // ─── 7. Verdict ───────────────────────────────────────────────────────────
  verdict("Verdict");
  if (dryRun) {
    pass("Dry-run complete — no DB writes performed");
  } else {
    warn("--write specified but this script is simulation-only; no actual writes");
  }
  if (underTimeout) {
    pass(`Total time ${totalTimeStr} is under ${TIMEOUTS.CRON_SOFT_LIMIT_MS}ms timeout`);
  } else {
    fail(`Total time ${totalTimeStr} exceeds ${TIMEOUTS.CRON_SOFT_LIMIT_MS}ms timeout`);
  }
  info(`Processed ${freshJobs.length} jobs for ${userBreakdowns.length} users`);

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
