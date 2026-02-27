import type { ScrapedJob } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

export async function fetchArbeitnow(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  try {
    // Fetch multiple pages to get more listings
    const allResults: Array<{
      slug?: string; title?: string; company_name?: string;
      location?: string; description?: string; remote?: boolean;
      tags?: string[]; created_at?: number; url?: string;
    }> = [];
    for (const page of [1, 2, 3]) {
      const res = await fetchWithRetry(
        `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
        { headers: { "User-Agent": "JobPilot/1.0" } },
      );
      if (!res.ok) break;

      const data = await res.json();
      const pageResults = data?.data || [];
      if (pageResults.length === 0) break;
      allResults.push(...pageResults);
    }

    const results = allResults;

    for (const r of results) {
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
  } catch (err) {
    console.warn("[Arbeitnow] Scraper failed:", err);
  }

  return jobs;
}
