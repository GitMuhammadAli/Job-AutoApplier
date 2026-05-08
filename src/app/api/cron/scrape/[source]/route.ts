import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateSearchQueries } from "@/lib/scrapers/keyword-aggregator";
import { scrapeAndUpsert } from "@/lib/scrapers/scrape-source";
import { fetchJSearch } from "@/lib/scrapers/jsearch";
import { fetchIndeed } from "@/lib/scrapers/indeed";
import { fetchRemotive } from "@/lib/scrapers/remotive";
import { fetchArbeitnow } from "@/lib/scrapers/arbeitnow";
import { fetchAdzuna } from "@/lib/scrapers/adzuna";
import { fetchLinkedIn } from "@/lib/scrapers/linkedin";
import { fetchRozee } from "@/lib/scrapers/rozee";
import { fetchGoogleJobs } from "@/lib/scrapers/google-jobs";
import { fetchGoogleHiringPosts } from "@/lib/scrapers/google-hiring-posts";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import type { ScrapedJob, SearchQuery } from "@/types";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

type ScraperFn = (queries: SearchQuery[]) => Promise<ScrapedJob[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  jsearch: (q) => fetchJSearch(q),
  indeed: (q) => fetchIndeed(q),
  remotive: (q) => fetchRemotive(q),
  arbeitnow: (q) => fetchArbeitnow(q),
  adzuna: (q) => fetchAdzuna(q),
  linkedin: (q) => fetchLinkedIn(q),
  rozee: (q) => fetchRozee(q),
  google: (q) => fetchGoogleJobs(q),
  linkedin_posts: (q) => fetchGoogleHiringPosts(q),
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const { source } = await params;
  const tracker = createCronTracker(`scrape-${source}`);
  const scraperFn = SCRAPERS[source];

  if (!scraperFn) {
    return NextResponse.json(
      {
        error: `Unknown source: ${source}`,
        validSources: Object.keys(SCRAPERS),
      },
      { status: 400 },
    );
  }

  // Create ScraperRun row up-front so the diagnostics page (which reads
  // from prisma.scraperRun) sees this dedicated cron firing. Previously
  // only scrape-global wrote to ScraperRun via runScraper(), so jsearch
  // and indeed always showed "Not running" on the health dashboard even
  // though they fire every 6h via cron-job.org.
  const startedAt = new Date();
  const run = await prisma.scraperRun.create({
    data: { source, status: "running", startedAt },
  }).catch((err) => {
    console.error(`[scrape/${source}] Failed to create ScraperRun:`, err);
    return null;
  });
  const runId = run?.id;

  try {
    const queries = await aggregateSearchQueries();
    if (queries.length === 0) {
      if (runId) {
        await prisma.scraperRun.update({
          where: { id: runId },
          data: {
            status: "success",
            jobsFound: 0,
            jobsSaved: 0,
            durationMs: Date.now() - startedAt.getTime(),
            errorMessage: "No user keywords configured",
            completedAt: new Date(),
          },
        }).catch(() => {});
      }
      return NextResponse.json({
        message: "No user keywords configured",
        source,
        scraped: 0,
      });
    }

    const result = await scrapeAndUpsert(source, scraperFn, queries);

    if (runId) {
      await prisma.scraperRun.update({
        where: { id: runId },
        data: {
          status: "success",
          jobsFound: result.newCount + result.updatedCount,
          jobsSaved: result.newCount,
          durationMs: Date.now() - startedAt.getTime(),
          completedAt: new Date(),
        },
      }).catch(() => {});
    }

    await prisma.systemLog.create({
      data: {
        type: "scrape",
        source,
        message: `Scraped ${result.newCount} new, ${result.updatedCount} updated from ${source}`,
        metadata: { newCount: result.newCount, updatedCount: result.updatedCount },
      },
    });

    await tracker.success({ processed: result.newCount, metadata: { updated: result.updatedCount } });

    return NextResponse.json({
      success: true,
      source,
      ...result,
    });
  } catch (error) {
    if (runId) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await prisma.scraperRun.update({
        where: { id: runId },
        data: {
          status: "failed",
          jobsFound: 0,
          jobsSaved: 0,
          durationMs: Date.now() - startedAt.getTime(),
          errorMessage: errMsg,
          completedAt: new Date(),
        },
      }).catch(() => {});
    }
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError(`Scrape/${source}`, error, `Scrape ${source} failed`);
  }
}
