import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { TIMEOUTS } from "@/lib/constants";
import { logApiCall } from "@/lib/api-usage-logger";

export async function fetchGoogleJobs(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const startTime = Date.now();
  const deadline = startTime + TIMEOUTS.SCRAPER_DEADLINE_MS;
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  const MAX_QUERIES = 3;
  const MAX_CITIES = 2;
  if (queries.length > MAX_QUERIES) {
    console.log(`[GoogleJobs] Truncating ${queries.length} queries to ${MAX_QUERIES} (dropped: ${queries.slice(MAX_QUERIES).map(q => q.keyword).join(", ")})`);
  }
  for (const q of queries.slice(0, MAX_QUERIES)) {
    if (Date.now() >= deadline) break;

    for (const city of q.cities.slice(0, MAX_CITIES)) {
      if (Date.now() >= deadline) break;

      try {
        const query = encodeURIComponent(`${q.keyword} jobs ${city || ""}`);
        const url = `https://serpapi.com/search.json?engine=google_jobs&q=${query}&api_key=${key}`;

        const res = await fetchWithRetry(url, undefined, 2, deadline);
        logApiCall("serpapi").catch(() => {});
        if (!res.ok) continue;

        const data = await res.json();
        const results = data?.jobs_results || [];

        for (const r of results) {
          const applyLink = r.apply_options?.[0]?.link || null;
          const titleSlug = (r.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const companySlug = (r.company_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const sourceId = r.job_id
            ? `google-${r.job_id}`
            : `google-${titleSlug}-${companySlug}`;
          if (seen.has(sourceId)) continue;
          seen.add(sourceId);

          jobs.push({
            title: r.title || "Untitled",
            company: r.company_name || "Unknown",
            location: r.location || null,
            description: r.description || null,
            salary: r.detected_extensions?.salary || null,
            jobType: r.detected_extensions?.schedule_type?.toLowerCase() || null,
            experienceLevel: null,
            category: null,
            skills: [],
            postedDate: r.detected_extensions?.posted_at
              ? parseRelativeDate(r.detected_extensions.posted_at)
              : null,
            source: "google",
            sourceId,
            sourceUrl: applyLink,
            applyUrl: applyLink,
            companyUrl: null,
            companyEmail: null,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.message === "SCRAPER_DEADLINE") break;
        console.warn(`[GoogleJobs] Failed for "${q.keyword}" in "${city}":`, err);
      }
    }
  }

  console.debug(`[GoogleJobs] Total scraped: ${jobs.length} jobs in ${Date.now() - startTime}ms`);
  return jobs;
}

function parseRelativeDate(text: string): Date | null {
  const now = new Date();
  const match = text.match(/(\d+)\s*(day|hour|week|month)/i);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith("hour")) now.setHours(now.getHours() - num);
  else if (unit.startsWith("day")) now.setDate(now.getDate() - num);
  else if (unit.startsWith("week")) now.setDate(now.getDate() - num * 7);
  else if (unit.startsWith("month")) now.setMonth(now.getMonth() - num);

  return now;
}
