import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { computeMatchScore, MATCH_THRESHOLDS } from "@/lib/matching/score-engine";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdmin();

    const users = await prisma.userSettings.findMany({
      where: { isOnboarded: true },
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
      },
    });

    let cleaned = 0;
    let checked = 0;

    for (const settings of users) {
      const resumes = await prisma.resume.findMany({
        where: { userId: settings.userId, isDeleted: false },
        select: { id: true, name: true, content: true },
      });

      const userJobs = await prisma.userJob.findMany({
        where: {
          userId: settings.userId,
          isDismissed: false,
          stage: "SAVED",
        },
        include: { globalJob: true },
      });

      for (const uj of userJobs) {
        checked++;
        const match = computeMatchScore(uj.globalJob, settings, resumes);

        if (match.score < MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
          const hasSentApp = await prisma.jobApplication.findFirst({
            where: {
              userJobId: uj.id,
              status: { in: ["SENT", "SENDING"] },
            },
          });

          if (!hasSentApp) {
            await prisma.userJob.update({
              where: { id: uj.id },
              data: { isDismissed: true },
            });
            cleaned++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: users.length,
      jobsChecked: checked,
      jobsCleaned: cleaned,
    });
  } catch (error) {
    console.error("[cleanup-matches]", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 }
    );
  }
}
