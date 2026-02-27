import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { TIMEOUTS } from "@/lib/constants";

const ADZUNA_COUNTRY_MAP: Record<string, string> = {
  pakistan: "pk", india: "in", "united states": "us", usa: "us",
  "united kingdom": "gb", uk: "gb", canada: "ca", australia: "au",
  germany: "de", france: "fr", netherlands: "nl", spain: "es",
  italy: "it", brazil: "br", singapore: "sg", poland: "pl",
  austria: "at", "new zealand": "nz", switzerland: "ch",
  "south africa": "za", russia: "ru", belgium: "be", mexico: "mx",
};

function resolveCountryCode(cities: string[]): string {
  for (const city of cities) {
    const lower = city.toLowerCase().trim();
    for (const [name, code] of Object.entries(ADZUNA_COUNTRY_MAP)) {
      if (lower === name || lower.includes(name) || lower.endsWith(code)) {
        return code;
      }
    }
  }
  return process.env.ADZUNA_COUNTRY || "us";
}

export async function fetchAdzuna(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const startTime = Date.now();
  const deadline = startTime + TIMEOUTS.SCRAPER_DEADLINE_MS;
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  for (const q of queries.slice(0, 3)) {
    if (Date.now() >= deadline) break;

    try {
      const country = resolveCountryCode(q.cities || []);
      const keyword = encodeURIComponent(q.keyword);

      // Only fetch page 1 to stay within time budget
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${keyword}&results_per_page=50&max_days_old=14&sort_by=date`;

      const res = await fetchWithRetry(url, undefined, 2, deadline);
      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.results || [];

      for (const r of results) {
        const sourceId = `adzuna-${r.id}`;
        if (seen.has(sourceId)) continue;
        seen.add(sourceId);

        jobs.push({
          title: r.title || "Untitled",
          company: r.company?.display_name || "Unknown",
          location: r.location?.display_name || null,
          description: r.description || null,
          salary: formatSalary(r.salary_min, r.salary_max),
          jobType: r.contract_time || null,
          experienceLevel: null,
          category: r.category?.label || null,
          skills: [],
          postedDate: r.created ? new Date(r.created) : null,
          source: "adzuna",
          sourceId,
          sourceUrl: r.redirect_url || null,
          applyUrl: r.redirect_url || null,
          companyUrl: null,
          companyEmail: null,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message === "SCRAPER_DEADLINE") break;
      console.warn(`[Adzuna] Failed for "${q.keyword}":`, err);
    }
  }

  console.log(`[Adzuna] Total scraped: ${jobs.length} jobs in ${Date.now() - startTime}ms`);
  return jobs;
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  if (min && max) return `$${Math.round(min).toLocaleString()}-$${Math.round(max).toLocaleString()}`;
  if (min) return `$${Math.round(min).toLocaleString()}+`;
  if (max) return `Up to $${Math.round(max).toLocaleString()}`;
  return null;
}
