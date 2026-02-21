import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeAndUpsert } from "@/lib/scrapers/scrape-source";
import { fetchIndeed } from "@/lib/scrapers/indeed";
import { fetchRemotive } from "@/lib/scrapers/remotive";
import { fetchArbeitnow } from "@/lib/scrapers/arbeitnow";
import { fetchLinkedIn } from "@/lib/scrapers/linkedin";
import { fetchRozee } from "@/lib/scrapers/rozee";
import { fetchJSearch } from "@/lib/scrapers/jsearch";
import { fetchAdzuna } from "@/lib/scrapers/adzuna";
import { fetchGoogleJobs } from "@/lib/scrapers/google-jobs";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import { checkRateLimit } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/constants";
import type { ScrapedJob, SearchQuery } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const userId = await getAuthUserId();

    const rateCheck = checkRateLimit(userId, "scan-now");
    if (!rateCheck.allowed) {
      const wait = Math.ceil((rateCheck.retryAfterMs || 60000) / 1000);
      return NextResponse.json(
        { error: `Please wait ${wait}s before scanning again.` },
        { status: 429 },
      );
    }

    const lastScanLog = await prisma.systemLog.findFirst({
      where: {
        type: "MANUAL_SCAN",
        source: userId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (
      lastScanLog &&
      Date.now() - lastScanLog.createdAt.getTime() < LIMITS.SCAN_COOLDOWN_MS
    ) {
      const wait = Math.ceil(
        (LIMITS.SCAN_COOLDOWN_MS - (Date.now() - lastScanLog.createdAt.getTime())) / 1000,
      );
      return NextResponse.json(
        { error: `Please wait ${wait}s before scanning again.` },
        { status: 429 },
      );
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.keywords?.length) {
      return NextResponse.json(
        { error: "Add keywords in settings first." },
        { status: 400 },
      );
    }

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

    const queries: SearchQuery[] = (settings.keywords ?? [])
      .slice(0, 8)
      .map((keyword: string) => ({
        keyword: keyword.toLowerCase().trim(),
        cities: Array.from(cities),
      }));

    const sources: {
      name: string;
      fn: (q: SearchQuery[]) => Promise<ScrapedJob[]>;
      needsKey?: string;
    }[] = [
      { name: "indeed", fn: fetchIndeed },
      { name: "remotive", fn: fetchRemotive },
      { name: "arbeitnow", fn: () => fetchArbeitnow() },
      { name: "linkedin", fn: fetchLinkedIn },
      { name: "rozee", fn: fetchRozee },
      { name: "jsearch", fn: fetchJSearch, needsKey: "RAPIDAPI_KEY" },
      { name: "adzuna", fn: fetchAdzuna, needsKey: "ADZUNA_APP_ID" },
      { name: "google", fn: fetchGoogleJobs, needsKey: "SERPAPI_KEY" },
    ].filter((s) => !s.needsKey || process.env[s.needsKey]);

    // Filter to user's selected platforms
    const userPlatforms = (settings.preferredPlatforms ?? []).length
      ? new Set(
          (settings.preferredPlatforms ?? []).map((p: string) =>
            p.toLowerCase().replace(/\./g, ""),
          ),
        )
      : null;

    const activeSources = userPlatforms
      ? sources.filter((s) => {
          const normalized = s.name.toLowerCase().replace(/\./g, "");
          return userPlatforms.has(normalized);
        })
      : sources;

    // Run all scrapers in parallel for speed
    const scrapeResults = await Promise.allSettled(
      activeSources.map(async (source) => {
        try {
          const result = await scrapeAndUpsert(source.name, source.fn, queries);
          return { name: source.name, newCount: result.newCount ?? 0 };
        } catch (err) {
          console.warn(`[scan-now] ${source.name} failed:`, err);
          return { name: source.name, newCount: 0 };
        }
      }),
    );

    let totalNew = 0;
    const sourceStats: Record<string, number> = {};
    for (const r of scrapeResults) {
      if (r.status === "fulfilled") {
        totalNew += r.value.newCount;
        sourceStats[r.value.name] = r.value.newCount;
      }
    }

    // Match new jobs against user profile
    let matched = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const newGlobalJobs = await prisma.globalJob.findMany({
      where: { createdAt: { gte: oneHourAgo } },
      take: LIMITS.MATCH_BATCH,
    });

    const existingLinks = await prisma.userJob.findMany({
      where: { userId },
      select: { globalJobId: true },
      take: LIMITS.EXISTING_JOB_IDS,
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
      take: 50,
    });

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
          source: job.source,
          firstSeenAt: job.firstSeenAt,
        },
        settingsLike,
        userResumes,
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

    return NextResponse.json({
      success: true,
      newJobs: totalNew,
      matched,
      sources: sourceStats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not authenticated" || message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[scan-now] Error:", error);
    return NextResponse.json(
      { error: "Scan failed. Please try again." },
      { status: 500 },
    );
  }
}
