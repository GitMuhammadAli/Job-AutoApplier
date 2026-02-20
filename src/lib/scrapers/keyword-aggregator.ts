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

  // For paid APIs, limit to top 5 most popular keywords to preserve quota
  if (mode === "paid") {
    keywords = keywords
      .sort((a, b) => (keywordPopularity.get(b) || 0) - (keywordPopularity.get(a) || 0))
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
