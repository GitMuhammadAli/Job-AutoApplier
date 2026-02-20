import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

export async function fetchIndeed(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  for (const q of queries.slice(0, 8)) {
    for (const city of q.cities.slice(0, 3)) {
      try {
        const keyword = encodeURIComponent(q.keyword);
        const location = encodeURIComponent(city);
        const url = `https://www.indeed.com/rss?q=${keyword}&l=${location}&sort=date&limit=25`;

        const res = await fetchWithRetry(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
        });
        if (!res.ok) continue;

        const xml = await res.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const item of items) {
          const title = extractTag(item, "title");
          const link = extractTag(item, "link");
          const pubDate = extractTag(item, "pubDate");
          const desc = extractTag(item, "description");
          const source = extractTag(item, "source");

          if (!title) continue;

          const company = source || extractCompanyFromTitle(title);

          jobs.push({
            title: cleanTitle(title),
            company: company || "Unknown",
            location: city !== "Remote" ? city : "Remote",
            description: cleanHtml(desc || ""),
            salary: null,
            jobType: null,
            experienceLevel: null,
            category: null,
            skills: [],
            postedDate: pubDate ? new Date(pubDate) : null,
            source: "indeed",
            sourceId: link ? `indeed-${hashString(link)}` : `indeed-${Date.now()}-${Math.random()}`,
            sourceUrl: link || null,
            applyUrl: link || null,
            companyUrl: null,
            companyEmail: null,
          });
        }
      } catch (err) {
        console.warn(`[Indeed] Failed for "${q.keyword}" in "${city}":`, err);
      }
    }
  }

  return jobs;
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s"));
  return match ? match[1].trim() : null;
}

function cleanTitle(title: string): string {
  return title.replace(/ - .+$/, "").trim();
}

function extractCompanyFromTitle(title: string): string {
  const match = title.match(/ - (.+)$/);
  return match ? match[1].trim() : "Unknown";
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
