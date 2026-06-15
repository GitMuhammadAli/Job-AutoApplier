import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";
import { extractSkillsFromContent } from "@/lib/skill-extractor";
import { logApiCall } from "@/lib/api-usage-logger";
import { TIMEOUTS } from "@/lib/constants";

/**
 * Fetches Rozee.pk jobs via SerpAPI Google Jobs.
 * Rozee's website is a client-side SPA with CAPTCHA protection, making direct
 * scraping impractical. Google has already indexed Rozee listings, so we
 * search Google Jobs for Pakistan-based roles and identify Rozee-sourced ones.
 *
 * Was 5 queries × 2 pages = 10 SerpAPI calls with NO deadline budget — every
 * run blew the 25s ceiling. Now: 3×1 with deadline awareness + per-call
 * timeout via fetchWithRetry's deadline param. Tightens worst-case to ~18s.
 */
export async function fetchRozee(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const startTime = Date.now();
  const deadline = startTime + TIMEOUTS.SCRAPER_SLOW_DEADLINE_MS;
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  const PK_CITIES = ["lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "multan", "peshawar", "hyderabad", "quetta", "sialkot"];

  const MAX_QUERIES = 3;
  for (const q of queries.slice(0, MAX_QUERIES)) {
    if (Date.now() >= deadline) break;
    try {
      const query = encodeURIComponent(`${q.keyword} jobs Pakistan`);
      // Was `chips=date_posted:week` — too narrow for niche keywords. Broadened
      // to past month; recency still beats nothing returned at all.
      const baseUrl = `https://serpapi.com/search.json?engine=google_jobs&q=${query}&chips=date_posted:month&api_key=${key}`;

      // Single page only — second-page returns from SerpAPI for Pakistan
      // queries are usually <5 results and not worth the latency.
      const pages = [0];

      for (const start of pages) {
        if (Date.now() >= deadline) break;
        if (start > 0) await new Promise((r) => setTimeout(r, 150));
        const url = start === 0 ? baseUrl : `${baseUrl}&start=${start}`;

        const res = await fetchWithRetry(url, undefined, 2, deadline);
        await logApiCall("serpapi");
        if (!res.ok) {
          // Was silently breaking on non-2xx — masquerades auth/quota failure
          // as "0 results returned" in the dashboard. Surface the actual
          // SerpAPI status so the operator can act on it.
          const body = await res.text().catch(() => "<no body>");
          console.error(
            `[Rozee] SerpAPI ${res.status} for "${q.keyword}": ${body.slice(0, 200)}`,
          );
          break;
        }

        const data = await res.json();
        const results = data?.jobs_results || [];

        if (results.length === 0) {
          console.warn(
            `[Rozee] SerpAPI returned 0 results for "${q.keyword}" (search_metadata: ${
              data?.search_metadata?.status ?? "unknown"
            }; error: ${data?.error ?? "none"})`,
          );
        }

        for (const r of results) {
          const locLower = (r.location || "").toLowerCase();
          // Query already says "Pakistan" — SerpAPI's location signal has done
          // the work. Re-filtering by literal PK_CITIES match drops remote
          // roles that target Pakistan but don't list a PK city. Soft-filter
          // only: skip results that explicitly mention a foreign country.
          const FOREIGN_HARD_HINTS = ["united states", " usa", " uk", "united kingdom", "canada", "australia", "germany"];
          if (FOREIGN_HARD_HINTS.some((c) => locLower.includes(c))) continue;
          // PK_CITIES retained for future strict-mode use; query bias already
          // limits to Pakistan results in practice.
          void PK_CITIES;

          const applyOptions: Array<{ link?: string; title?: string }> = r.apply_options || [];
          const rozeeLink = applyOptions.find(
            (opt) => opt.link && opt.link.toLowerCase().includes("rozee.pk")
          );
          const applyUrl = rozeeLink?.link || applyOptions[0]?.link || null;
          const titleSlug = (r.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
          const compSlug = (r.company_name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
          const sourceId = `rozee-${r.job_id || `${titleSlug}-${compSlug}`}`;

          if (seen.has(sourceId)) continue;
          seen.add(sourceId);

          const title = r.title || "Untitled";
          const description = r.description || null;
          const skills = extractSkillsFromContent(description || "");

          jobs.push({
            title,
            company: r.company_name || "Unknown",
            location: r.location || "Pakistan",
            description,
            salary: r.detected_extensions?.salary || null,
            jobType: r.detected_extensions?.schedule_type?.toLowerCase() || null,
            experienceLevel: null,
            category: categorizeJob(title, skills, description || ""),
            skills,
            postedDate: r.detected_extensions?.posted_at
              ? parseRelativeDate(r.detected_extensions.posted_at)
              : null,
            source: "rozee",
            sourceId,
            sourceUrl: applyUrl,
            applyUrl,
            companyUrl: null,
            companyEmail: null,
          });
        }

        if (results.length < 10) break;
      }
    } catch (err) {
      if (err instanceof Error && err.message === "SCRAPER_DEADLINE") break;
      console.warn(`[Rozee] Failed for "${q.keyword}":`, err);
    }
  }

  console.debug(`[Rozee] Total scraped: ${jobs.length} jobs in ${Date.now() - startTime}ms`);
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
