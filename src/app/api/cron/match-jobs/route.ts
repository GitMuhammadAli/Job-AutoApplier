import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { buildExistingJobKeys, isDuplicateByKey } from "@/lib/matching/location-filter";
import { LIMITS, TIMEOUTS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("match-jobs");
  const startTime = Date.now();
  const cursorUserId = req.nextUrl.searchParams.get("cursor") || undefined;
  const batchSize = Math.min(parseInt(req.nextUrl.searchParams.get("batch") || "50", 10) || 50, 500);

  try {
    const users = await prisma.userSettings.findMany({
      where: { keywords: { isEmpty: false }, isOnboarded: true, accountStatus: "active" },
      select: {
        userId: true,
        keywords: true,
        city: true,
        country: true,
        experienceLevel: true,
        workType: true,
        jobType: true,
        preferredCategories: true,
        preferredPlatforms: true,
        salaryMin: true,
        salaryMax: true,
        minMatchScoreForAutoApply: true,
      },
      orderBy: { userId: "asc" },
      take: batchSize,
      ...(cursorUserId ? { skip: 1, cursor: { userId: cursorUserId } } : {}),
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No configured users", matched: 0, nextCursor: null });
    }

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const rawRecent = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        lastSeenAt: { gte: oneDayAgo },
      },
      take: LIMITS.MATCH_BATCH,
    });

    // Round-robin by source for fair processing across all platforms
    const bySource = new Map<string, typeof rawRecent>();
    for (const job of rawRecent) {
      const list = bySource.get(job.source) || [];
      list.push(job);
      bySource.set(job.source, list);
    }
    const sources = Array.from(bySource.keys());
    const recentJobs: typeof rawRecent = [];
    let rrIdx = 0;
    let rrMore = true;
    while (rrMore) {
      rrMore = false;
      for (const src of sources) {
        const list = bySource.get(src)!;
        if (rrIdx < list.length) {
          recentJobs.push(list[rrIdx]);
          if (rrIdx + 1 < list.length) rrMore = true;
        }
      }
      rrIdx++;
    }

    if (recentJobs.length === 0) {
      return NextResponse.json({
        message: "No recent jobs to match",
        matched: 0,
      });
    }

    let totalMatched = 0;
    const userStats: Record<string, number> = {};

    for (const user of users) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      const resumes = await prisma.resume.findMany({
        where: { userId: user.userId },
        select: { id: true, name: true, content: true, detectedSkills: true },
      });

      const existingUserJobs = await prisma.userJob.findMany({
        where: { userId: user.userId },
        select: { globalJobId: true, globalJob: { select: { title: true, company: true } } },
        take: LIMITS.EXISTING_JOB_IDS,
      });
      const existingIds = new Set(existingUserJobs.map((uj) => uj.globalJobId));
      const existingJobKeys = buildExistingJobKeys(
        existingUserJobs.map((j) => j.globalJob)
      );

      let userMatched = 0;

      for (const job of recentJobs) {
        if (existingIds.has(job.id)) continue;
        if (isDuplicateByKey(existingJobKeys, job.title, job.company)) continue;

        const match = computeMatchScore(job, user, resumes);

        if (match.score < MATCH_THRESHOLDS.SHOW_ON_KANBAN) continue;

        try {
          await prisma.userJob.create({
            data: {
              userId: user.userId,
              globalJobId: job.id,
              stage: "SAVED",
              matchScore: match.score,
              matchReasons: match.reasons,
            },
          });
          userMatched++;
        } catch (err) {
          const isPrismaUnique = typeof err === "object" && err !== null && (err as Record<string, unknown>).code === "P2002";
          if (!isPrismaUnique) {
            console.error(`[MatchJobs] Unexpected error creating UserJob for user ${user.userId}, job ${job.id}:`, err);
          }
        }
      }

      userStats[user.userId] = userMatched;
      totalMatched += userMatched;
    }

    const processedUsers = Object.keys(userStats).length;
    const nextCursor = users.length === batchSize
      ? users[users.length - 1].userId
      : null;

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "match-jobs",
        message: `Matched ${totalMatched} jobs for ${processedUsers} users from ${recentJobs.length} recent jobs${nextCursor ? " (more users pending)" : ""}`,
        metadata: { users: processedUsers, recentJobs: recentJobs.length, totalMatched, nextCursor },
      },
    });

    await tracker.success({ processed: totalMatched, metadata: { users: processedUsers, recentJobs: recentJobs.length, nextCursor } });

    return NextResponse.json({
      success: true,
      users: processedUsers,
      recentJobs: recentJobs.length,
      totalMatched,
      perUser: userStats,
      nextCursor,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("MatchJobs", error, "Match failed");
  }
}
