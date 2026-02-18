import type { ScrapedJob, SearchQuery } from "@/types";

export async function fetchIndeed(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  for (const q of queries.slice(0, 5)) {
    for (const city of q.cities.slice(0, 2)) {
      try {
        const keyword = encodeURIComponent(q.keyword);
        const location = encodeURIComponent(city);
        const url = `https://www.indeed.com/rss?q=${keyword}&l=${location}&sort=date&limit=25`;

        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; JobPilot/1.0)" },
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
      } catch {
        // Skip failed queries
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
