import { prisma } from "@/lib/prisma";
import type { SearchQuery } from "@/types";

export async function aggregateSearchQueries(mode?: string): Promise<SearchQuery[]> {
  const allSettings = await prisma.userSettings.findMany({
    where: {
      keywords: { isEmpty: false },
      accountStatus: "active",
    },
    select: {
      keywords: true,
      city: true,
      country: true,
    },
  });

  const keywordCityMap = new Map<string, Set<string>>();
  const keywordPopularity = new Map<string, number>();

  for (const settings of allSettings) {
    const cities = new Set<string>();
    cities.add("Remote");
    if (settings.city) cities.add(settings.city);
    if (settings.country) cities.add(settings.country);

    for (const keyword of settings.keywords) {
      const normalized = keyword
        .toLowerCase()
        .trim()
        .replace(/[^\w\s.#+\-/]/g, "")
        .replace(/\s+/g, " ");
      if (!normalized || normalized.length < 2) continue;

      keywordPopularity.set(normalized, (keywordPopularity.get(normalized) || 0) + 1);

      if (!keywordCityMap.has(normalized)) {
        keywordCityMap.set(normalized, new Set<string>());
      }
      const existing = keywordCityMap.get(normalized)!;
      cities.forEach((c) => existing.add(c));
    }
  }

  let keywords = Array.from(keywordCityMap.keys());

  // For paid APIs, rank keywords by ROI (application outcomes) not just popularity.
  // Keywords that led to sent applications are worth 3x more than mere popularity.
  if (mode === "paid") {
    const keywordSentCounts = await getKeywordApplicationCounts().catch(() => new Map<string, number>());

    keywords = keywords
      .sort((a, b) => {
        const popA = keywordPopularity.get(a) || 0;
        const popB = keywordPopularity.get(b) || 0;
        const sentA = keywordSentCounts.get(a) || 0;
        const sentB = keywordSentCounts.get(b) || 0;
        const scoreA = popA + sentA * 3;
        const scoreB = popB + sentB * 3;
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }

  const queries: SearchQuery[] = [];
  for (const keyword of keywords) {
    const cities = keywordCityMap.get(keyword);
    if (cities) {
      queries.push({
        keyword,
        cities: Array.from(cities),
      });
    }
  }

  return queries;
}

/**
 * Count how many sent applications each keyword contributed to in the last 30 days.
 * Uses matchReasons on UserJob to identify which keywords drove successful applications.
 */
async function getKeywordApplicationCounts(): Promise<Map<string, number>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sentApps = await prisma.jobApplication.findMany({
    where: {
      status: "SENT",
      sentAt: { gte: thirtyDaysAgo },
    },
    select: {
      userJob: {
        select: { matchReasons: true },
      },
    },
    take: 500,
  });

  const counts = new Map<string, number>();

  for (const app of sentApps) {
    if (!app.userJob?.matchReasons) continue;
    for (const reason of app.userJob.matchReasons) {
      // matchReasons look like "Keywords: react, node.js (2/14)"
      const kwMatch = reason.match(/Keywords?:\s*(.+?)(?:\s*\(|$)/i);
      if (!kwMatch) continue;
      const kws = kwMatch[1].split(",").map((k) => k.trim().toLowerCase());
      for (const kw of kws) {
        if (kw.length >= 2) {
          counts.set(kw, (counts.get(kw) || 0) + 1);
        }
      }
    }
  }

  return counts;
}
