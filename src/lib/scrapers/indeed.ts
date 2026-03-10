import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";
import { extractSkillsFromContent } from "@/lib/skill-extractor";
import { TIMEOUTS } from "@/lib/constants";
import { logApiCall } from "@/lib/api-usage-logger";

/**
 * Fetches Indeed jobs via JSearch (RapidAPI) — filters by publisher "Indeed".
 * Indeed's own RSS feed is deprecated and blocked; JSearch aggregates Indeed
 * listings through Google for Jobs, giving us reliable access.
 *
 * Time-budget aware for Vercel 10s limit.
 */
export async function fetchIndeed(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const startTime = Date.now();
  const deadline = startTime + TIMEOUTS.SCRAPER_DEADLINE_MS;
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  const MAX_QUERIES = 2;
  const MAX_CITIES = 1;
  if (queries.length > MAX_QUERIES) {
    console.log(`[Indeed] Truncating ${queries.length} queries to ${MAX_QUERIES} (dropped: ${queries.slice(MAX_QUERIES).map(q => q.keyword).join(", ")})`);
  }
  for (const q of queries.slice(0, MAX_QUERIES)) {
    if (Date.now() >= deadline) break;

    for (const city of q.cities.slice(0, MAX_CITIES)) {
      if (Date.now() >= deadline) break;
      if (jobs.length > 0) await new Promise((r) => setTimeout(r, 200));

      try {
        const query = `${q.keyword} jobs in ${city}`;
        const res = await fetchWithRetry(
          `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1&date_posted=today`,
          {
            headers: {
              "x-rapidapi-host": "jsearch.p.rapidapi.com",
              "x-rapidapi-key": key,
            },
          },
          1,
          deadline,
        );

        await logApiCall("jsearch");

        if (!res.ok) {
          console.warn(`[Indeed] HTTP ${res.status} for "${q.keyword}" in "${city}"`);
          continue;
        }

        const data = await res.json();
        const results = data?.data || [];

        for (const r of results) {
          const publisher = (r.job_publisher || "").toLowerCase();
          if (!publisher.includes("indeed")) continue;

          const titleSlug = (r.job_title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
          const compSlug = (r.employer_name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
          const id = r.job_id || `indeed-${titleSlug}-${compSlug}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = r.job_title || "Untitled";
          const description = r.job_description || null;

          jobs.push({
            title,
            company: r.employer_name || "Unknown",
            location: [r.job_city, r.job_state, r.job_country]
              .filter(Boolean)
              .join(", ") || null,
            description,
            salary: formatSalary(r.job_min_salary, r.job_max_salary, r.job_salary_currency),
            jobType: r.job_employment_type?.toLowerCase() || null,
            experienceLevel: r.job_required_experience?.experience_level || null,
            category: categorizeJob(title, extractSkillsFromContent(description || ""), description || ""),
            skills: extractSkillsFromContent(description || ""),
            postedDate: r.job_posted_at_datetime_utc ? new Date(r.job_posted_at_datetime_utc) : null,
            source: "indeed",
            sourceId: id,
            sourceUrl: r.job_google_link || null,
            applyUrl: r.job_apply_link || r.job_google_link || null,
            companyUrl: r.employer_website || null,
            companyEmail: null,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.message === "SCRAPER_DEADLINE") break;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Indeed] Failed for "${q.keyword}" in "${city}":`, msg);
      }
    }
  }

  console.debug(`[Indeed] Total scraped: ${jobs.length} jobs in ${Date.now() - startTime}ms`);
  return jobs;
}

function formatSalary(min?: number, max?: number, currency?: string): string | null {
  if (!min && !max) return null;
  const c = currency || "USD";
  if (min && max) return `${c} ${min.toLocaleString()}-${max.toLocaleString()}`;
  if (min) return `${c} ${min.toLocaleString()}+`;
  if (max) return `${c} up to ${max.toLocaleString()}`;
  return null;
}
