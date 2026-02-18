import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchJSearch } from "./jsearch";
import { fetchIndeed } from "./indeed";
import { fetchRemotive } from "./remotive";
import { fetchArbeitnow } from "./arbeitnow";
import { fetchAdzuna } from "./adzuna";
import { fetchLinkedIn } from "./linkedin";
import { fetchRozee } from "./rozee";
import { fetchGoogleJobs } from "./google-jobs";

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

/**
 * Orchestrate all scrapers, run in parallel, deduplicate across sources.
 * Keeps the entry with the longer description when duplicates are found.
 */
export async function scrapeAllSourcesGlobal(
  queries: SearchQuery[],
  sources: string[]
): Promise<{ jobs: ScrapedJob[]; stats: Record<string, number> }> {
  const promises = sources
    .filter((s) => SCRAPERS[s])
    .map(async (source) => {
      try {
        const jobs = await SCRAPERS[source](queries);
        return { source, jobs };
      } catch {
        return { source, jobs: [] as ScrapedJob[] };
      }
    });

  const results = await Promise.allSettled(promises);

  const stats: Record<string, number> = {};
  const allJobs: ScrapedJob[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { source, jobs } = result.value;
      stats[source] = jobs.length;
      allJobs.push(...jobs);
    }
  }

  // Cross-source deduplication with better normalization
  const dedupMap = new Map<string, ScrapedJob>();
  for (const job of allJobs) {
    const normTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normCompany = job.company
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|gmbh|co|company|pvt|private|limited)\b/g, "")
      .replace(/[^a-z0-9]/g, "");
    const key = `${normTitle}|${normCompany}`;
    const existing = dedupMap.get(key);

    if (!existing) {
      dedupMap.set(key, job);
    } else {
      // Keep entry with more data (longer description)
      const existingLen = existing.description?.length || 0;
      const newLen = job.description?.length || 0;
      if (newLen > existingLen) {
        dedupMap.set(key, job);
      }
    }
  }

  return {
    jobs: Array.from(dedupMap.values()),
    stats,
  };
}
