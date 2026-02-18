import { prisma } from "@/lib/prisma";
import type { SearchQuery } from "@/types";

/**
 * Aggregate search queries from ALL users' settings.
 * Merges and deduplicates keywords (case-insensitive).
 * Always includes "Remote" as a city for every keyword.
 */
export async function aggregateSearchQueries(): Promise<SearchQuery[]> {
  const allSettings = await prisma.userSettings.findMany({
    where: {
      keywords: { isEmpty: false },
    },
    select: {
      keywords: true,
      city: true,
      country: true,
    },
  });

  const keywordCityMap = new Map<string, Set<string>>();

  for (const settings of allSettings) {
    const cities = new Set<string>();
    cities.add("Remote");
    if (settings.city) cities.add(settings.city);
    if (settings.country) cities.add(settings.country);

    for (const keyword of settings.keywords) {
      const normalized = keyword.toLowerCase().trim();
      if (!normalized) continue;

      if (!keywordCityMap.has(normalized)) {
        keywordCityMap.set(normalized, new Set<string>());
      }
      const existing = keywordCityMap.get(normalized)!;
      cities.forEach((c) => existing.add(c));
    }
  }

  const queries: SearchQuery[] = [];
  keywordCityMap.forEach((cities, keyword) => {
    queries.push({
      keyword,
      cities: Array.from(cities),
    });
  });

  return queries;
}
