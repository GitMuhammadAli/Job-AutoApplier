import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";
import { fetchJSearch } from "./jsearch";
import { TIMEOUTS } from "@/lib/constants";

/**
 * LinkedIn selector changelog:
 * 2026-02-26: Initial configurable selectors via env vars
 * 2026-02-27: Time-budget aware for Vercel 10s limit
 * When LinkedIn changes CSS classes, update env vars or defaults below.
 */

// Configurable selectors via env (comma-separated for fallbacks)
const SELECTORS = {
  title: (process.env.LINKEDIN_SELECTOR_TITLE || "base-search-card__title,base-card__title").split(",").map((s) => s.trim()),
  company: (process.env.LINKEDIN_SELECTOR_COMPANY || "base-search-card__subtitle,base-card__subtitle").split(",").map((s) => s.trim()),
  location: (process.env.LINKEDIN_SELECTOR_LOCATION || "job-search-card__location,base-search-card__metadata,job-card__location").split(",").map((s) => s.trim()),
  snippet: (process.env.LINKEDIN_SELECTOR_SNIPPET || "job-search-card__snippet,base-search-card__snippet").split(",").map((s) => s.trim()),
  cardPatterns: (process.env.LINKEDIN_SELECTOR_CARDS || "base-search-card,job-search-card,base-card,jobs-search__results").split(",").map((s) => s.trim()),
};

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

export async function fetchLinkedIn(
  queries: SearchQuery[],
): Promise<ScrapedJob[]> {
  const startTime = Date.now();
  const deadline = startTime + TIMEOUTS.SCRAPER_SLOW_DEADLINE_MS;
  const jobs: ScrapedJob[] = [];
  const seenIds = new Set<string>();

  const MAX_QUERIES = 3;
  const MAX_CITIES = 2;
  if (queries.length > MAX_QUERIES) {
    console.log(`[LinkedIn] Truncating ${queries.length} queries to ${MAX_QUERIES} (dropped: ${queries.slice(MAX_QUERIES).map(q => q.keyword).join(", ")})`);
  }
  const querySlice = queries.slice(0, MAX_QUERIES);

  for (const q of querySlice) {
    if (Date.now() >= deadline) break;

    for (const city of q.cities.slice(0, MAX_CITIES)) {
      if (Date.now() >= deadline) break;

      try {
        const keyword = encodeURIComponent(q.keyword);
        const location = encodeURIComponent(city);
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

        // Only fetch page 1 (24h filter only, no backfill)
        const page1 = await fetchLinkedInPage(keyword, location, 0, "r86400", ua, deadline);
        jobs.push(...parseLinkedInHtml(page1, city, seenIds));
      } catch (err) {
        if (err instanceof Error && err.message === "SCRAPER_DEADLINE") break;
        console.warn(`[LinkedIn] Failed for "${q.keyword}" in "${city}":`, err);
      }

      // Minimal delay between cities
      if (Date.now() < deadline - 1000) {
        await sleep(100 + Math.random() * 200);
      }
    }
  }

  if (jobs.length === 0) {
    // Don't waste time on debug fetch — just log and try fallback
    console.warn(`[LinkedIn] Returned 0 jobs for ${querySlice.length} queries in ${Date.now() - startTime}ms`);

    // Only attempt JSearch fallback if enough time budget remains
    const remaining = deadline - Date.now();
    if (process.env.RAPIDAPI_KEY && remaining > 3000) {
      console.warn(`[LinkedIn] Falling back to JSearch (${remaining}ms remaining)`);
      return fetchJSearch(queries, 2);
    }
  }

  console.debug(`[LinkedIn] Total scraped: ${jobs.length} jobs in ${Date.now() - startTime}ms`);
  return jobs;
}

async function fetchLinkedInPage(
  keyword: string,
  location: string,
  start: number,
  timeFilter: string,
  ua: string,
  deadline: number,
): Promise<string> {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keyword}&location=${location}&start=${start}&f_TPR=${timeFilter}&sortBy=DD`;

  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": ua, ...ACCEPT_HEADERS },
  }, 1, deadline);

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

  const hasCards = SELECTORS.cardPatterns.some((p) => html.includes(p));
  if (!hasCards) {
    console.warn("[LinkedIn] No recognized card structure in response");
    return [];
  }

  const cards = html.match(/<li[\s\S]*?<\/li>/g) || [];
  const jobs: ScrapedJob[] = [];

  for (const card of cards.slice(0, 25)) {
    const title =
      SELECTORS.title.map((c) => extractAttr(card, c)).find(Boolean) ||
      extractTagContent(card, "h3");
    const company =
      SELECTORS.company.map((c) => extractAttr(card, c)).find(Boolean) ||
      extractHiddenSubtitle(card);
    const location =
      SELECTORS.location.map((c) => extractAttr(card, c)).find(Boolean) || null;
    const link = extractHref(card);
    const dateStr = extractDateTime(card);

    if (!title || !company) continue;

    const jobIdMatch = link?.match(/\/view\/(\d+)/);
    const titleSlug = cleanText(title).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    const companySlug = cleanText(company).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    const jobId = jobIdMatch
      ? jobIdMatch[1]
      : `${titleSlug}-${companySlug}`;

    if (seenIds.has(jobId)) continue;
    seenIds.add(jobId);

    const snippet =
      SELECTORS.snippet.map((c) => extractAttr(card, c)).find(Boolean) || null;

    const cleanTitle = cleanText(title);
    const cleanSnippet = snippet ? cleanText(snippet) : "";
    jobs.push({
      title: cleanTitle,
      company: cleanText(company),
      location: location ? cleanText(location) : fallbackCity,
      description: cleanSnippet || null,
      salary: extractSalary(card),
      jobType: null,
      experienceLevel: null,
      category: categorizeJob(cleanTitle, [], cleanSnippet),
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
  const regex = new RegExp(
    `class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/`,
    "i",
  );
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]*>/g, "").trim() : null;
}

function extractTagContent(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]*>/g, "").trim() : null;
}

function extractHiddenSubtitle(html: string): string | null {
  const match = html.match(
    /class="[^"]*hidden-nested-link[^"]*"[^>]*>[\s\S]*?<\/a>/i,
  );
  if (!match) return null;
  return match[0].replace(/<[^>]*>/g, "").trim() || null;
}

function extractHref(html: string): string | null {
  const match = html.match(
    /href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/,
  );
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
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
