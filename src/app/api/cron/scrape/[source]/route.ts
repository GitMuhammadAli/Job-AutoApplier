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
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import type { ScrapedJob, SearchQuery } from "@/types";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

type ScraperFn = (queries: SearchQuery[]) => Promise<ScrapedJob[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  jsearch: (q) => fetchJSearch(q),
  indeed: (q) => fetchIndeed(q),
  remotive: (q) => fetchRemotive(q),
  arbeitnow: () => fetchArbeitnow(),
  adzuna: (q) => fetchAdzuna(q),
  linkedin: (q) => fetchLinkedIn(q),
  rozee: (q) => fetchRozee(q),
  google: (q) => fetchGoogleJobs(q),
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

  try {
    const queries = await aggregateSearchQueries();
    if (queries.length === 0) {
      return NextResponse.json({
        message: "No user keywords configured",
        source,
        scraped: 0,
      });
    }

    const result = await scrapeAndUpsert(source, scraperFn, queries);

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
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError(`Scrape/${source}`, error, `Scrape ${source} failed`);
  }
}
