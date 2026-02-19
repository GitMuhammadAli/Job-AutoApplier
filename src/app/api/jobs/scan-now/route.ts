import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeAndUpsert } from "@/lib/scrapers/scrape-source";
import { fetchIndeed } from "@/lib/scrapers/indeed";
import { fetchRemotive } from "@/lib/scrapers/remotive";
import { fetchArbeitnow } from "@/lib/scrapers/arbeitnow";
import { computeMatchScore, MATCH_THRESHOLDS } from "@/lib/matching/score-engine";
import type { ScrapedJob, SearchQuery } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function POST() {
  try {
    const userId = await getAuthUserId();

    // Persistent cooldown via SystemLog
    const lastScanLog = await prisma.systemLog.findFirst({
      where: {
        type: "MANUAL_SCAN",
        source: userId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastScanLog && Date.now() - lastScanLog.createdAt.getTime() < COOLDOWN_MS) {
      const wait = Math.ceil(
        (COOLDOWN_MS - (Date.now() - lastScanLog.createdAt.getTime())) / 1000
      );
      return NextResponse.json(
        { error: `Please wait ${wait}s before scanning again.` },
        { status: 429 }
      );
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.keywords?.length) {
      return NextResponse.json(
        { error: "Add keywords in settings first." },
        { status: 400 }
      );
    }

    // Record the scan in SystemLog
    await prisma.systemLog.create({
      data: {
        type: "MANUAL_SCAN",
        source: userId,
        message: `Manual scan triggered by user`,
      },
    });

    const cities = new Set<string>(["Remote"]);
    if (settings.city) cities.add(settings.city);
    if (settings.country) cities.add(settings.country);

    const queries: SearchQuery[] = settings.keywords
      .slice(0, 5)
      .map((keyword) => ({
        keyword: keyword.toLowerCase().trim(),
        cities: Array.from(cities),
      }));

    const sources = [
      { name: "indeed", fn: fetchIndeed },
      { name: "remotive", fn: fetchRemotive },
      { name: "arbeitnow", fn: () => fetchArbeitnow() },
    ];

    let totalNew = 0;
    for (const source of sources) {
      try {
        const result = await scrapeAndUpsert(
          source.name,
          source.fn as (q: SearchQuery[]) => Promise<ScrapedJob[]>,
          queries
        );
        totalNew += result.newCount ?? 0;
      } catch {
        // individual source failure ok
      }
    }

    // Match new jobs against user profile
    let matched = 0;
    if (totalNew > 0) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const newGlobalJobs = await prisma.globalJob.findMany({
        where: { createdAt: { gte: oneHourAgo } },
        take: 200,
      });

      const existingLinks = await prisma.userJob.findMany({
        where: { userId },
        select: { globalJobId: true },
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
        select: { id: true, name: true, content: true },
      });
      const resumes = userResumes;

      const toCreate: Array<{
        userId: string;
        globalJobId: string;
        matchScore: number;
        matchReasons: string[];
      }> = [];

      for (const job of newGlobalJobs) {
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
            firstSeenAt: job.firstSeenAt,
          },
          settingsLike,
          resumes
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
    }

    return NextResponse.json({ success: true, newJobs: totalNew, matched });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
