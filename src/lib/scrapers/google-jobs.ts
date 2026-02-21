import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

export async function fetchGoogleJobs(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  // Only run on even days to conserve 100/month limit
  const dayOfMonth = new Date().getDate();
  if (dayOfMonth % 2 !== 0) return [];

  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  for (const q of queries.slice(0, 4)) {
    for (const city of q.cities.slice(0, 2)) {
      try {
        const query = encodeURIComponent(`${q.keyword} jobs ${city || ""}`);
        const url = `https://serpapi.com/search.json?engine=google_jobs&q=${query}&api_key=${key}`;

        const res = await fetchWithRetry(url);
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
        console.warn(`[GoogleJobs] Failed for "${q.keyword}" in "${city}":`, err);
      }
    }
  }

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
