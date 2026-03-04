import { prisma } from "@/lib/prisma";

/**
 * Determine which sources to scrape today.
 * Free sources run daily. Paid sources are rotated to stay within free tier limits.
 */
export function getTodaysSources(): string[] {
  const sources: string[] = [];

  sources.push("indeed", "remotive", "arbeitnow", "linkedin", "rozee", "linkedin_posts");

  if (process.env.RAPIDAPI_KEY) {
    sources.push("jsearch");
  }

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
 */
export function getPaidSourcesToday(): string[] {
  const sources: string[] = [];

  if (process.env.RAPIDAPI_KEY) {
    sources.push("jsearch");
    sources.push("indeed");
  }
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) sources.push("adzuna");

  if (process.env.SERPAPI_KEY) {
    sources.push("google");
    sources.push("rozee");
  }

  return sources;
}

const FREE_SOURCES = ["remotive", "arbeitnow", "linkedin", "linkedin_posts"];

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
