import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/matching/score-engine";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users with settings
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

    // Get active GlobalJobs from last 24h (newly scraped or refreshed)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentJobs = await prisma.globalJob.findMany({
      where: {
        isActive: true,
        isFresh: false,
        lastSeenAt: { gte: oneDayAgo },
      },
    });

    if (recentJobs.length === 0) {
      return NextResponse.json({ message: "No recent jobs to match", matched: 0 });
    }

    let totalMatched = 0;
    const userStats: Record<string, number> = {};

    for (const user of users) {
      // Get user's resumes for skill matching
      const resumes = await prisma.resume.findMany({
        where: { userId: user.userId },
        select: { id: true, name: true, content: true },
      });

      // Get existing UserJob globalJobIds to avoid duplicates
      const existingIds = new Set(
        (await prisma.userJob.findMany({
          where: { userId: user.userId },
          select: { globalJobId: true },
        })).map((uj) => uj.globalJobId)
      );

      let userMatched = 0;

      for (const job of recentJobs) {
        if (existingIds.has(job.id)) continue;

        const match = computeMatchScore(job, user, resumes);

        // Only create UserJob if score >= 20 (low threshold to show on board)
        if (match.score < 20) continue;

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

    return NextResponse.json({
      success: true,
      users: users.length,
      recentJobs: recentJobs.length,
      totalMatched,
      perUser: userStats,
    });
  } catch (error) {
    console.error("Match jobs error:", error);
    return NextResponse.json(
      { error: "Match failed", details: String(error) },
      { status: 500 }
    );
  }
}
