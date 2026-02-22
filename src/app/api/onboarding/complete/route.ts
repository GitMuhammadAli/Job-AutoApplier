import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { STARTER_TEMPLATES } from "@/constants/templates";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await getAuthUserId();

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({ totalScanned: 0, matched: 0 });
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const globalJobs = await prisma.globalJob.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      take: 2000,
      orderBy: { createdAt: "desc" },
    });

    const existingLinks = await prisma.userJob.findMany({
      where: { userId },
      select: { globalJobId: true },
      take: 10000,
    });
    const linkedSet = new Set(existingLinks.map((l) => l.globalJobId));

    const settingsLike = {
      keywords: settings.keywords,
      city: settings.city,
      country: settings.country,
      experienceLevel: settings.experienceLevel,
      workType: settings.workType,
      jobType: settings.jobType,
      preferredCategories: settings.preferredCategories,
      preferredPlatforms: settings.preferredPlatforms,
      salaryMin: settings.salaryMin,
      salaryMax: settings.salaryMax,
    };

    const userResumes = await prisma.resume.findMany({
      where: { userId, isDeleted: false },
      select: { id: true, name: true, content: true, detectedSkills: true },
      take: 50,
    });
    const resumes = userResumes;

    let matched = 0;
    const toCreate: Array<{
      userId: string;
      globalJobId: string;
      matchScore: number;
      matchReasons: string[];
    }> = [];

    for (const job of globalJobs) {
      if (linkedSet.has(job.id)) continue;

      const result = computeMatchScore(
        {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          salary: job.salary,
          jobType: job.jobType,
          experienceLevel: job.experienceLevel,
          category: job.category,
          skills: job.skills,
          source: job.source,
          firstSeenAt: job.firstSeenAt,
        },
        settingsLike,
        resumes,
      );

      if (result.score >= MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
        toCreate.push({
          userId,
          globalJobId: job.id,
          matchScore: result.score,
          matchReasons: result.reasons,
        });
        matched++;
      }
    }

    if (toCreate.length > 0) {
      await prisma.userJob.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    // Seed starter email templates if user has none
    const existingTemplates = await prisma.emailTemplate.count({
      where: { userId },
    });
    if (existingTemplates === 0) {
      await prisma.emailTemplate.createMany({
        data: STARTER_TEMPLATES.map((t) => ({
          userId,
          settingsId: settings.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          isDefault: t.isDefault,
        })),
      });
    }

    return NextResponse.json({
      totalScanned: globalJobs.length,
      matched,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not authenticated" || message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[onboarding/complete] Error:", error);
    return NextResponse.json(
      { totalScanned: 0, matched: 0, error: "Matching encountered an error" },
      { status: 500 },
    );
  }
}
