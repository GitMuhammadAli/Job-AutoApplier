import type { ScrapedJob } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

export async function fetchArbeitnow(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  try {
    const res = await fetchWithRetry("https://www.arbeitnow.com/api/job-board-api", {
      headers: { "User-Agent": "JobPilot/1.0" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results = data?.data || [];

    for (const r of results) {
      const sourceId = `arbeitnow-${r.slug || `${(r.title || "").toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}`}`;
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
  } catch {
    // Silently skip
  }

  return jobs;
}
