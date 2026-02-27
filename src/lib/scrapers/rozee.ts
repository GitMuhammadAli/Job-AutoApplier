import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";
import { extractSkillsFromContent } from "@/lib/skill-extractor";

/**
 * Fetches Rozee.pk jobs via SerpAPI Google Jobs.
 * Rozee's website is a client-side SPA with CAPTCHA protection, making direct
 * scraping impractical. Google has already indexed Rozee listings, so we
 * search Google Jobs for Pakistan-based roles and identify Rozee-sourced ones.
 */
export async function fetchRozee(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  const PK_CITIES = ["lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "multan", "peshawar", "hyderabad", "quetta", "sialkot"];

  for (const q of queries.slice(0, 5)) {
    try {
      // Search Google Jobs for Pakistan-specific listings
      const query = encodeURIComponent(`${q.keyword} jobs Pakistan`);
      const url = `https://serpapi.com/search.json?engine=google_jobs&q=${query}&api_key=${key}`;

      const res = await fetchWithRetry(url);
      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.jobs_results || [];

      for (const r of results) {
        const locLower = (r.location || "").toLowerCase();
        const isPakistan = locLower.includes("pakistan") ||
          PK_CITIES.some((c) => locLower.includes(c));

        if (!isPakistan) continue;

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
    } catch (err) {
      console.warn(`[Rozee] Failed for "${q.keyword}":`, err);
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
