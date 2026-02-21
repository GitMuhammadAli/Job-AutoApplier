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

// Scraper health tracking: consecutive errors + last result counts
const scraperHealth: Record<string, { consecutiveErrors: number; lastCount: number; prevCount: number }> = {};

export interface ScraperHealthAlert {
  source: string;
  type: "consecutive_errors" | "result_drop";
  message: string;
}

function trackScraperResult(source: string, count: number, error: boolean): ScraperHealthAlert | null {
  if (!scraperHealth[source]) {
    scraperHealth[source] = { consecutiveErrors: 0, lastCount: 0, prevCount: 0 };
  }
  const h = scraperHealth[source];

  if (error) {
    h.consecutiveErrors++;
    if (h.consecutiveErrors >= 3) {
      return {
        source,
        type: "consecutive_errors",
        message: `${source} has failed ${h.consecutiveErrors} consecutive times`,
      };
    }
    return null;
  }

  h.consecutiveErrors = 0;
  h.prevCount = h.lastCount;
  h.lastCount = count;

  if (h.prevCount > 10 && count < h.prevCount * 0.2) {
    return {
      source,
      type: "result_drop",
      message: `${source} results dropped 80%: ${h.prevCount} → ${count}`,
    };
  }

  return null;
}

export function getScraperHealthAlerts(): ScraperHealthAlert[] {
  const alerts: ScraperHealthAlert[] = [];
  for (const [source, h] of Object.entries(scraperHealth)) {
    if (h.consecutiveErrors >= 3) {
      alerts.push({
        source,
        type: "consecutive_errors",
        message: `${source} has failed ${h.consecutiveErrors} consecutive times`,
      });
    }
  }
  return alerts;
}

/**
 * Orchestrate all scrapers, run in parallel, deduplicate across sources.
 * Keeps the entry with the longer description when duplicates are found.
 */
export async function scrapeAllSourcesGlobal(
  queries: SearchQuery[],
  sources: string[]
): Promise<{ jobs: ScrapedJob[]; stats: Record<string, number>; healthAlerts: ScraperHealthAlert[] }> {
  const promises = sources
    .filter((s) => SCRAPERS[s])
    .map(async (source) => {
      try {
        const jobs = await SCRAPERS[source](queries);
        return { source, jobs, error: false };
      } catch {
        return { source, jobs: [] as ScrapedJob[], error: true };
      }
    });

  const results = await Promise.allSettled(promises);

  const stats: Record<string, number> = {};
  const allJobs: ScrapedJob[] = [];
  const healthAlerts: ScraperHealthAlert[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { source, jobs, error } = result.value;
      stats[source] = jobs.length;
      allJobs.push(...jobs);

      const alert = trackScraperResult(source, jobs.length, error);
      if (alert) healthAlerts.push(alert);
    }
  }

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
    healthAlerts,
  };
}
