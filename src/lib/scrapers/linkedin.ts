import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

const ACCEPT_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

// Time filters: past 24h first (freshest), then past week for backfill
const TIME_FILTERS = [
  { param: "r86400", label: "24h" },
  { param: "r604800", label: "7d" },
];

export async function fetchLinkedIn(queries: SearchQuery[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const seenIds = new Set<string>();

  // Use up to 8 queries (was 3) and ALL cities per query
  const querySlice = queries.slice(0, 8);

  for (const q of querySlice) {
    // Search each city (was limited to 1)
    for (const city of q.cities.slice(0, 3)) {
      for (const timeFilter of TIME_FILTERS) {
        try {
          const keyword = encodeURIComponent(q.keyword);
          const location = encodeURIComponent(city);
          const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

          // Fetch first page
          const page1 = await fetchLinkedInPage(keyword, location, 0, timeFilter.param, ua);
          const parsed1 = parseLinkedInHtml(page1, city, seenIds);
          jobs.push(...parsed1);

          // If first page returned results, try page 2
          if (parsed1.length >= 10) {
            await sleep(500 + Math.random() * 1000);
            const page2 = await fetchLinkedInPage(keyword, location, 25, timeFilter.param, ua);
            const parsed2 = parseLinkedInHtml(page2, city, seenIds);
            jobs.push(...parsed2);
          }

          // Only use 24h filter if it returned results; skip 7d for this keyword+city
          if (parsed1.length > 0 && timeFilter.label === "24h") break;
        } catch (err) {
          console.warn(`[LinkedIn] Failed for "${q.keyword}" in "${city}" (${timeFilter.label}):`, err);
        }
      }
      // Small delay between cities to avoid rate limiting
      await sleep(300 + Math.random() * 700);
    }
  }

  console.log(`[LinkedIn] Total scraped: ${jobs.length} jobs`);
  return jobs;
}

async function fetchLinkedInPage(
  keyword: string,
  location: string,
  start: number,
  timeFilter: string,
  ua: string,
): Promise<string> {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keyword}&location=${location}&start=${start}&f_TPR=${timeFilter}&sortBy=DD`;

  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": ua, ...ACCEPT_HEADERS },
  });

  if (!res.ok) {
    console.warn(`[LinkedIn] HTTP ${res.status} for ${keyword}/${location}`);
    return "";
  }

  return res.text();
}

function parseLinkedInHtml(
  html: string,
  fallbackCity: string,
  seenIds: Set<string>,
): ScrapedJob[] {
  if (!html || html.length < 200) return [];

  if (html.includes("captcha") || html.includes("authwall")) {
    console.warn("[LinkedIn] Blocked — captcha or authwall detected");
    return [];
  }

  // LinkedIn has changed class names over time — check for multiple patterns
  const hasCards =
    html.includes("base-search-card") ||
    html.includes("job-search-card") ||
    html.includes("base-card") ||
    html.includes("jobs-search__results");

  if (!hasCards) {
    console.warn("[LinkedIn] No recognized card structure in response");
    return [];
  }

  const cards = html.match(/<li[\s\S]*?<\/li>/g) || [];
  const jobs: ScrapedJob[] = [];

  for (const card of cards.slice(0, 25)) {
    const title =
      extractAttr(card, "base-search-card__title") ||
      extractAttr(card, "base-card__title") ||
      extractTagContent(card, "h3");
    const company =
      extractAttr(card, "base-search-card__subtitle") ||
      extractAttr(card, "base-card__subtitle") ||
      extractHiddenSubtitle(card);
    const location =
      extractAttr(card, "job-search-card__location") ||
      extractAttr(card, "base-search-card__metadata") ||
      extractAttr(card, "job-card__location");
    const link = extractHref(card);
    const dateStr = extractDateTime(card);

    if (!title || !company) continue;

    const jobIdMatch = link?.match(/\/view\/(\d+)/);
    const jobId = jobIdMatch ? jobIdMatch[1] : `li-${Date.now()}-${Math.random()}`;

    if (seenIds.has(jobId)) continue;
    seenIds.add(jobId);

    // Try to extract any snippet text that might serve as a description
    const snippet = extractAttr(card, "job-search-card__snippet") ||
      extractAttr(card, "base-search-card__snippet") || null;

    jobs.push({
      title: cleanText(title),
      company: cleanText(company),
      location: location ? cleanText(location) : fallbackCity,
      description: snippet ? cleanText(snippet) : null,
      salary: extractSalary(card),
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

  return jobs;
}

function extractAttr(html: string, className: string): string | null {
  const regex = new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i");
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]*>/g, "").trim() : null;
}

function extractTagContent(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]*>/g, "").trim() : null;
}

function extractHiddenSubtitle(html: string): string | null {
  const match = html.match(/class="[^"]*hidden-nested-link[^"]*"[^>]*>[\s\S]*?<\/a>/i);
  if (!match) return null;
  return match[0].replace(/<[^>]*>/g, "").trim() || null;
}

function extractHref(html: string): string | null {
  const match = html.match(/href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    return `${url.origin}${url.pathname}`;
  } catch {
    return match[1];
  }
}

function extractDateTime(html: string): string | null {
  const match = html.match(/datetime="([^"]+)"/);
  return match ? match[1] : null;
}

function extractSalary(html: string): string | null {
  const match = html.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i);
  return match ? cleanText(match[1]) : null;
}

function cleanText(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
