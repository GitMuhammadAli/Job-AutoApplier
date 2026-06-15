import { prisma } from "@/lib/prisma";

/**
 * Determine which sources to scrape today.
 * Free sources run daily. Paid sources are rotated to stay within free tier limits.
 */
export function getTodaysSources(): string[] {
  const sources: string[] = [];

  sources.push("remotive", "arbeitnow", "linkedin", "rozee", "linkedin_posts");

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    sources.push("adzuna");
  }

  if (process.env.SERPAPI_KEY) {
    sources.push("google");
  }

  return sources;
}

/**
 * Get paid sources for daily scraping (conserve quotas).
 *
 * Adzuna is technically paid but their free tier (250 calls/day) is generous
 * enough that we treat it as free-ish — no rotation needed. The paid sources
 * with tight monthly caps are SerpAPI (rozee+google, 250/mo free) and
 * RapidAPI JSearch (jsearch+indeed, 200/mo free) — those are what we want
 * to ration. See docs/SCRAPER_QUOTAS.md for the full matrix.
 */
export function getPaidSourcesToday(): string[] {
  const sources: string[] = [];

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) sources.push("adzuna");

  if (process.env.SERPAPI_KEY) {
    sources.push("google");
    sources.push("rozee");
  }

  if (process.env.RAPIDAPI_KEY) {
    sources.push("jsearch");
    sources.push("indeed");
  }

  return sources;
}

/**
 * Full quota tier classification, used by docs + the disable mechanism.
 * Mutually exclusive with PAID_SOURCES below.
 */
const FREE_SOURCES = ["remotive", "arbeitnow", "linkedin", "linkedin_posts"];
export const PAID_SOURCES = ["adzuna", "google", "rozee", "jsearch", "indeed"];

/**
 * SKIP_PAID_SOURCES=1 toggle — one-flip way to graceful-skip every paid
 * source at once (vs. listing each in DISABLED_SCRAPERS). Useful when a
 * shared upstream (SerpAPI, RapidAPI) is quota-out and you want every
 * dependent source off in one move.
 */
export function isPaidSourceDisabledByEnv(source: string): boolean {
  if (process.env.SKIP_PAID_SOURCES !== "1") return false;
  return PAID_SOURCES.includes(source.toLowerCase());
}

/**
 * Get priority platforms from all users who have instantApply enabled.
 * Only returns free sources to avoid burning paid API quotas every 15 min.
 */
export async function getPriorityPlatforms(): Promise<string[]> {
  const settings = await prisma.userSettings.findMany({
    where: {
      instantApplyEnabled: true,
      autoApplyEnabled: true,
      applicationMode: "FULL_AUTO",
    },
    select: { priorityPlatforms: true },
  });

  const platforms = new Set<string>();
  for (const s of settings) {
    for (const p of s.priorityPlatforms ?? []) {
      platforms.add(p);
    }
  }

  if (platforms.size === 0) platforms.add("rozee");

  return Array.from(platforms).filter((p) => FREE_SOURCES.includes(p));
}
