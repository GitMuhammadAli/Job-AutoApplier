import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

const MAX_KEYWORDS_PER_RUN = 5;

export async function fetchRemotive(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  // Build a list of unique search terms (keyword phrases). Remotive's
  // `?search=` queries title+description server-side, so we get fewer
  // irrelevant rows back per call vs pulling the global feed and
  // client-filtering. Cap the number of API calls per cron tick.
  const keywords = Array.from(
    new Set(queries.map((q) => q.keyword.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, MAX_KEYWORDS_PER_RUN);

  // If we have no keywords (e.g. cold start, no users yet), fall back to
  // the unfiltered global feed once instead of skipping.
  const queryUrls = keywords.length > 0
    ? keywords.map((kw) => `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw)}&limit=100`)
    : ["https://remotive.com/api/remote-jobs?limit=100"];

  for (const url of queryUrls) {
    try {
      const res = await fetchWithRetry(url, { headers: { "User-Agent": "JobPilot/1.0" } });
      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.jobs || [];

      for (const r of results) {
        const sourceId = `remotive-${r.id}`;
        if (seen.has(sourceId)) continue;
        seen.add(sourceId);

        jobs.push({
          title: r.title || "Untitled",
          company: r.company_name || "Unknown",
          location: r.candidate_required_location || "Remote",
          description: cleanHtml(r.description || ""),
          salary: r.salary || null,
          jobType: r.job_type?.toLowerCase() || null,
          experienceLevel: null,
          category: r.category || null,
          skills: r.tags || [],
          postedDate: r.publication_date ? new Date(r.publication_date) : null,
          source: "remotive",
          sourceId,
          sourceUrl: r.url || null,
          applyUrl: r.url || null,
          companyUrl: r.company_logo_url || null,
          companyEmail: null,
        });
      }
    } catch (err) {
      console.warn(`[Remotive] Scraper failed for ${url}:`, err);
    }
  }

  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return jobs.filter((j) => !j.postedDate || j.postedDate.getTime() >= threeDaysAgo);
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
