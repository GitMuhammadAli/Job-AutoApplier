import type { ScrapedJob, SearchQuery } from "@/types";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

export async function fetchRozee(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  for (const q of queries.slice(0, 3)) {
    try {
      const keyword = encodeURIComponent(q.keyword);
      const url = `https://www.rozee.pk/job/jsearch/q/${keyword}`;

      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const res = await fetch(url, {
        headers: { "User-Agent": ua },
      });
      if (!res.ok) continue;

      const html = await res.text();

      if (html.includes("captcha") || html.includes("access denied") || html.length < 500) {
        console.warn("[Rozee] Likely blocked — CAPTCHA or access denied detected");
        continue;
      }

      const listings = html.match(/<div class="job[^"]*"[\s\S]*?<\/div>\s*<\/div>/g) || [];

      for (const listing of listings.slice(0, 15)) {
        const title = extractText(listing, /class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//);
        const company = extractText(listing, /class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//);
        const location = extractText(listing, /class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//);
        const link = extractLink(listing);

        if (!title) continue;

        const sourceId = link
          ? `rozee-${hashString(link)}`
          : `rozee-${Date.now()}-${Math.random()}`;

        jobs.push({
          title: cleanHtml(title),
          company: cleanHtml(company || "Unknown"),
          location: cleanHtml(location || "Pakistan"),
          description: null,
          salary: null,
          jobType: null,
          experienceLevel: null,
          category: null,
          skills: [],
          postedDate: null,
          source: "rozee",
          sourceId,
          sourceUrl: link ? `https://www.rozee.pk${link}` : null,
          applyUrl: link ? `https://www.rozee.pk${link}` : null,
          companyUrl: null,
          companyEmail: null,
        });
      }
    } catch {
      // Skip
    }
  }

  return jobs;
}

function extractText(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function extractLink(html: string): string | null {
  const match = html.match(/href="(\/job\/[^"]+)"/);
  return match ? match[1] : null;
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
