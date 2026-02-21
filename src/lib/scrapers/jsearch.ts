import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

export async function fetchJSearch(
  queries: SearchQuery[],
  maxQueries = 6
): Promise<ScrapedJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();
  const limited = queries.slice(0, maxQueries);

  for (const q of limited) {
    for (const city of q.cities.slice(0, 2)) {
      try {
        const query = `${q.keyword} jobs in ${city}`;
        const res = await fetchWithRetry(
          `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1&date_posted=week`,
          {
            headers: {
              "x-rapidapi-host": "jsearch.p.rapidapi.com",
              "x-rapidapi-key": key,
            },
          }
        );

        if (!res.ok) continue;

        const data = await res.json();
        const results = data?.data || [];

        for (const r of results) {
          const titleSlug = (r.job_title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
          const compSlug = (r.employer_name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
          const id = r.job_id || `jsearch-${titleSlug}-${compSlug}`;
          if (seen.has(id)) continue;
          seen.add(id);

          jobs.push({
            title: r.job_title || "Untitled",
            company: r.employer_name || "Unknown",
            location: [r.job_city, r.job_state, r.job_country]
              .filter(Boolean)
              .join(", ") || null,
            description: r.job_description || null,
            salary: formatSalary(r.job_min_salary, r.job_max_salary, r.job_salary_currency),
            jobType: r.job_employment_type?.toLowerCase() || null,
            experienceLevel: r.job_required_experience?.experience_level || null,
            category: null,
            skills: extractSkills(r.job_description || ""),
            postedDate: r.job_posted_at_datetime_utc ? new Date(r.job_posted_at_datetime_utc) : null,
            source: "jsearch",
            sourceId: id,
            sourceUrl: r.job_google_link || null,
            applyUrl: r.job_apply_link || r.job_google_link || null,
            companyUrl: r.employer_website || null,
            companyEmail: null,
          });
        }
      } catch {
        // Skip failed queries silently
      }
    }
  }

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

function extractSkills(text: string): string[] {
  const skillPatterns = [
    "react", "vue", "angular", "next.js", "node.js", "express", "nestjs",
    "typescript", "javascript", "python", "java", "c#", "go", "rust", "ruby",
    "php", "swift", "kotlin", "flutter", "react native",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "graphql", "rest api", "microservices", "ci/cd", "git",
    "tailwind", "sass", "css", "html", "figma",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "django", "flask", "spring boot", "laravel", ".net",
  ];

  const lower = text.toLowerCase();
  return skillPatterns.filter((s) => lower.includes(s));
}
