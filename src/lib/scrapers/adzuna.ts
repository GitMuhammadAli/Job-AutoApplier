import type { ScrapedJob, SearchQuery } from "@/types";

export async function fetchAdzuna(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const jobs: ScrapedJob[] = [];

  for (const q of queries.slice(0, 3)) {
    try {
      const country = "us";
      const keyword = encodeURIComponent(q.keyword);
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${keyword}&results_per_page=20&max_days_old=7&sort_by=date`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.results || [];

      for (const r of results) {
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
          sourceId: `adzuna-${r.id}`,
          sourceUrl: r.redirect_url || null,
          applyUrl: r.redirect_url || null,
          companyUrl: null,
          companyEmail: null,
        });
      }
    } catch {
      // Skip failed queries
    }
  }

  return jobs;
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  if (min && max) return `$${Math.round(min).toLocaleString()}-$${Math.round(max).toLocaleString()}`;
  if (min) return `$${Math.round(min).toLocaleString()}+`;
  if (max) return `Up to $${Math.round(max).toLocaleString()}`;
  return null;
}
