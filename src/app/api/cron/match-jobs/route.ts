import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { LIMITS, TIMEOUTS } from "@/lib/constants";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false;
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const users = await prisma.userSettings.findMany({
      where: { keywords: { isEmpty: false } },
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
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No configured users", matched: 0 });
    }

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentJobs = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        lastSeenAt: { gte: oneDayAgo },
      },
      take: LIMITS.MATCH_BATCH,
    });

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
        select: { id: true, name: true, content: true },
      });

      const existingIds = new Set(
        (
          await prisma.userJob.findMany({
            where: { userId: user.userId },
            select: { globalJobId: true },
            take: LIMITS.EXISTING_JOB_IDS,
          })
        ).map((uj) => uj.globalJobId),
      );

      let userMatched = 0;

      for (const job of recentJobs) {
        if (existingIds.has(job.id)) continue;

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
        } catch {
          // Skip duplicate constraint violations
        }
      }

      userStats[user.userId] = userMatched;
      totalMatched += userMatched;
    }

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "match-jobs",
        message: `Matched ${totalMatched} jobs for ${users.length} users from ${recentJobs.length} recent jobs`,
        metadata: { users: users.length, recentJobs: recentJobs.length, totalMatched },
      },
    });

    return NextResponse.json({
      success: true,
      users: users.length,
      recentJobs: recentJobs.length,
      totalMatched,
      perUser: userStats,
    });
  } catch (error) {
    console.error("[MatchJobs] Error:", error);
    return NextResponse.json(
      { error: "Match failed", details: String(error) },
      { status: 500 },
    );
  }
}
