import { NextRequest, NextResponse } from "next/server";
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
import type { ScrapedJob, SearchQuery } from "@/types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

type ScraperFn = (queries: SearchQuery[]) => Promise<ScrapedJob[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  jsearch: (q) => fetchJSearch(q, 6),
  indeed: (q) => fetchIndeed(q),
  remotive: (q) => fetchRemotive(q),
  arbeitnow: () => fetchArbeitnow(),
  adzuna: (q) => fetchAdzuna(q),
  linkedin: (q) => fetchLinkedIn(q),
  rozee: (q) => fetchRozee(q),
  google: (q) => fetchGoogleJobs(q),
};

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = params.source;
  const scraperFn = SCRAPERS[source];

  if (!scraperFn) {
    return NextResponse.json(
      { error: `Unknown source: ${source}`, validSources: Object.keys(SCRAPERS) },
      { status: 400 }
    );
  }

  try {
    const queries = await aggregateSearchQueries();
    if (queries.length === 0) {
      return NextResponse.json({ message: "No user keywords configured", source, scraped: 0 });
    }

    const result = await scrapeAndUpsert(source, scraperFn, queries);

    return NextResponse.json({
      success: true,
      source,
      ...result,
    });
  } catch (error) {
    console.error(`[Scrape/${source}] error:`, error);
    return NextResponse.json(
      { error: `Scrape ${source} failed`, details: String(error) },
      { status: 500 }
    );
  }
}
