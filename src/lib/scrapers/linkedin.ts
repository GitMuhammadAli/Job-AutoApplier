import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

export async function fetchLinkedIn(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  for (const q of queries.slice(0, 3)) {
    for (const city of q.cities.slice(0, 1)) {
      try {
        const keyword = encodeURIComponent(q.keyword);
        const location = encodeURIComponent(city);
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keyword}&location=${location}&start=0&f_TPR=r604800`;

        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const res = await fetchWithRetry(url, {
          headers: { "User-Agent": ua },
        });
        if (!res.ok) continue;

        const html = await res.text();

        if (html.includes("captcha") || html.includes("authwall") || html.length < 200) {
          console.warn("[LinkedIn] Likely blocked — captcha or authwall detected");
          continue;
        }

        if (!html.includes("base-search-card") && !html.includes("job-search-card")) {
          console.warn("[LinkedIn] HTML structure may have changed — no recognized card classes found");
          continue;
        }

        const cards = html.match(/<li[\s\S]*?<\/li>/g) || [];

        for (const card of cards.slice(0, 15)) {
          const title = extractAttr(card, "base-search-card__title");
          const company = extractAttr(card, "base-search-card__subtitle");
          const location = extractAttr(card, "job-search-card__location");
          const link = extractHref(card);
          const dateStr = extractDateTime(card);

          if (!title || !company) continue;

          const jobIdMatch = link?.match(/(\d+)\??/);
          const jobId = jobIdMatch ? jobIdMatch[1] : `li-${Date.now()}-${Math.random()}`;

          jobs.push({
            title: title.trim(),
            company: company.trim(),
            location: location?.trim() || city,
            description: null,
            salary: null,
            jobType: null,
            experienceLevel: null,
            category: null,
            skills: [],
            postedDate: dateStr ? new Date(dateStr) : null,
            source: "linkedin",
            sourceId: `linkedin-${jobId}`,
            sourceUrl: link || null,
            applyUrl: link || null,
            companyUrl: null,
            companyEmail: null,
          });
        }
      } catch {
        // Skip
      }
    }
  }

  return jobs;
}

function extractAttr(html: string, className: string): string | null {
  const regex = new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i");
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]*>/g, "").trim() : null;
}

function extractHref(html: string): string | null {
  const match = html.match(/href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/);
  return match ? match[1] : null;
}

function extractDateTime(html: string): string | null {
  const match = html.match(/datetime="([^"]+)"/);
  return match ? match[1] : null;
}
