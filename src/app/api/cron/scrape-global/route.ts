import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateSearchQueries } from "@/lib/scrapers/keyword-aggregator";
import { getTodaysSources } from "@/lib/scrapers/source-rotation";
import { scrapeAllSourcesGlobal } from "@/lib/scrapers";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Aggregate search keywords from all users
    const queries = await aggregateSearchQueries();
    if (queries.length === 0) {
      return NextResponse.json({
        message: "No user keywords configured. Skipping scrape.",
        scraped: 0,
        new: 0,
        updated: 0,
      });
    }

    // 2. Determine which sources to scrape today
    const sources = getTodaysSources();

    // 3. Scrape all sources in parallel + deduplicate
    const { jobs, stats } = await scrapeAllSourcesGlobal(queries, sources);

    // 4. Upsert into GlobalJob table
    let newCount = 0;
    let updatedCount = 0;

    for (const job of jobs) {
      try {
        const result = await prisma.globalJob.upsert({
          where: {
            sourceId_source: {
              sourceId: job.sourceId,
              source: job.source,
            },
          },
          create: {
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            salary: job.salary,
            jobType: job.jobType,
            experienceLevel: job.experienceLevel,
            category: job.category,
            skills: job.skills,
            postedDate: job.postedDate,
            source: job.source,
            sourceId: job.sourceId,
            sourceUrl: job.sourceUrl,
            applyUrl: job.applyUrl,
            companyUrl: job.companyUrl,
            companyEmail: job.companyEmail,
            isActive: true,
            lastSeenAt: new Date(),
          },
          update: {
            lastSeenAt: new Date(),
            isActive: true,
            // Update description if new one is longer
            ...(job.description ? { description: job.description } : {}),
            ...(job.salary ? { salary: job.salary } : {}),
            ...(job.applyUrl ? { applyUrl: job.applyUrl } : {}),
            ...(job.companyEmail ? { companyEmail: job.companyEmail } : {}),
          },
        });

        // Check if it was a new record by comparing createdAt and updatedAt
        const isNew =
          result.createdAt.getTime() === result.updatedAt.getTime() ||
          Date.now() - result.createdAt.getTime() < 5000;

        if (isNew) newCount++;
        else updatedCount++;
      } catch {
        // Skip individual upsert failures (e.g. constraint violations)
      }
    }

    // 5. Trigger job matching for all users
    let matchResult = null;
    try {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const matchRes = await fetch(
        `${baseUrl}/api/cron/match-jobs?secret=${encodeURIComponent(process.env.CRON_SECRET || "")}`,
      );
      if (matchRes.ok) {
        matchResult = await matchRes.json();
      }
    } catch {
      // Match will run on its own cron schedule too
    }

    return NextResponse.json({
      success: true,
      queries: queries.length,
      sources,
      stats,
      totalScraped: jobs.length,
      new: newCount,
      updated: updatedCount,
      matching: matchResult,
    });
  } catch (error) {
    console.error("Scrape global error:", error);
    return NextResponse.json(
      { error: "Scrape failed", details: String(error) },
      { status: 500 }
    );
  }
}
