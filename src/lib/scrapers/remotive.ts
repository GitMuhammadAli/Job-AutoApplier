import type { ScrapedJob, SearchQuery } from "@/types";

export async function fetchRemotive(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=50", {
      headers: { "User-Agent": "JobPilot/1.0" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results = data?.jobs || [];

    const keywordArr = Array.from(
      new Set(queries.flatMap((q) => q.keyword.toLowerCase().split(/\s+/)))
    );

    for (const r of results) {
      const titleLower = (r.title || "").toLowerCase();
      const descLower = (r.description || "").toLowerCase();
      const tagsLower = (r.tags || []).map((t: string) => t.toLowerCase());

      const isRelevant =
        queries.length === 0 ||
        keywordArr.some(
          (kw) =>
            titleLower.includes(kw) ||
            descLower.includes(kw) ||
            tagsLower.some((t: string) => t.includes(kw))
        );

      if (!isRelevant) continue;

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
        sourceId: `remotive-${r.id}`,
        sourceUrl: r.url || null,
        applyUrl: r.url || null,
        companyUrl: r.company_logo_url || null,
        companyEmail: null,
      });
    }
  } catch {
    // Silently skip
  }

  return jobs;
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
