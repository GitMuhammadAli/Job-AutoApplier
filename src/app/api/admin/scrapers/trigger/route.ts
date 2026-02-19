import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { scrapeAndUpsert } from "@/lib/scrapers/scrape-source";
import { fetchIndeed } from "@/lib/scrapers/indeed";
import { fetchRemotive } from "@/lib/scrapers/remotive";
import { fetchArbeitnow } from "@/lib/scrapers/arbeitnow";
import { aggregateSearchQueries } from "@/lib/scrapers/keyword-aggregator";
import type { SearchQuery } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queries = await aggregateSearchQueries("free");

  if (!queries.length) {
    return NextResponse.json({ error: "No keywords found" }, { status: 400 });
  }

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
        source.fn as (q: SearchQuery[]) => Promise<any>,
        queries
      );
      totalNew += (result as any).newJobs ?? 0;
    } catch {
      await prisma.systemLog.create({
        data: {
          type: "error",
          source: source.name,
          message: `Admin-triggered scrape failed for ${source.name}`,
        },
      });
    }
  }

  return NextResponse.json({ success: true, newJobs: totalNew });
}
