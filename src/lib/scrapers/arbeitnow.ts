import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

const MAX_KEYWORDS_PER_RUN = 5;

interface ArbeitnowJob {
  slug?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  remote?: boolean;
  tags?: string[];
  created_at?: number;
  url?: string;
}

export async function fetchArbeitnow(queries: SearchQuery[] = []): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  // Arbeitnow's API supports `?search=` for server-side filtering. Without
  // it, we pull the global feed and after day 1 every job is a duplicate
  // (saved=0). Run one fetch per keyword (capped) so we actually surface
  // jobs matching active users.
  const keywords = Array.from(
    new Set(queries.map((q) => q.keyword.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, MAX_KEYWORDS_PER_RUN);

  const queryParams = keywords.length > 0
    ? keywords.map((kw) => `?search=${encodeURIComponent(kw)}`)
    : [""]; // global feed fallback when no users have keywords yet

  try {
    for (const params of queryParams) {
      // 2 pages per keyword keeps the per-cron API call count sane while
      // still surfacing recent listings beyond page 1.
      for (const page of [1, 2]) {
        const sep = params ? "&" : "?";
        const url = `https://www.arbeitnow.com/api/job-board-api${params}${sep}page=${page}`;
        const res = await fetchWithRetry(url, { headers: { "User-Agent": "JobPilot/1.0" } });
        if (!res.ok) break;

        const data = await res.json();
        const pageResults: ArbeitnowJob[] = data?.data || [];
        if (pageResults.length === 0) break;

        for (const r of pageResults) {
          const titleSlug = (r.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
          const compSlug = (r.company_name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
          const sourceId = `arbeitnow-${r.slug || `${titleSlug}-${compSlug}`}`;
          if (seen.has(sourceId)) continue;
          seen.add(sourceId);

          jobs.push({
            title: r.title || "Untitled",
            company: r.company_name || "Unknown",
            location: r.location || null,
            description: r.description || null,
            salary: null,
            jobType: r.remote ? "remote" : null,
            experienceLevel: null,
            category: null,
            skills: r.tags || [],
            postedDate: r.created_at ? new Date(r.created_at * 1000) : null,
            source: "arbeitnow",
            sourceId,
            sourceUrl: r.url || null,
            applyUrl: r.url || null,
            companyUrl: null,
            companyEmail: null,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Arbeitnow] Scraper failed:", err);
  }

  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return jobs.filter((j) => !j.postedDate || j.postedDate.getTime() >= threeDaysAgo);
}
