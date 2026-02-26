import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";
import { fetchJSearch } from "./jsearch";

/**
 * LinkedIn selector changelog:
 * 2026-02-26: Initial configurable selectors via env vars
 * When LinkedIn changes CSS classes, update env vars or defaults below.
 * Pattern: LinkedIn tends to rename base-search-card__X to job-card-X or similar.
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

// Time filters: past 24h first (freshest), then past week for backfill
const TIME_FILTERS = [
  { param: "r86400", label: "24h" },
  { param: "r604800", label: "7d" },
];

export async function fetchLinkedIn(
  queries: SearchQuery[],
): Promise<ScrapedJob[]> {
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
          const ua =
            USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

          const page1 = await fetchLinkedInPage(
            keyword,
            location,
            0,
            timeFilter.param,
            ua,
          );
          const parsed1 = parseLinkedInHtml(page1, city, seenIds);
          jobs.push(...parsed1);

          if (parsed1.length >= 10) {
            await sleep(400 + Math.random() * 800);
            const page2 = await fetchLinkedInPage(
              keyword,
              location,
              25,
              timeFilter.param,
              ua,
            );
            const parsed2 = parseLinkedInHtml(page2, city, seenIds);
            jobs.push(...parsed2);

            if (parsed2.length >= 15) {
              await sleep(400 + Math.random() * 800);
              const page3 = await fetchLinkedInPage(
                keyword,
                location,
                50,
                timeFilter.param,
                ua,
              );
              jobs.push(...parseLinkedInHtml(page3, city, seenIds));
            }
          }

          // Only use 24h filter if it returned results; skip 7d for this keyword+city
          if (parsed1.length > 0 && timeFilter.label === "24h") break;
        } catch (err) {
          console.warn(
            `[LinkedIn] Failed for "${q.keyword}" in "${city}" (${timeFilter.label}):`,
            err,
          );
        }
      }
      // Small delay between cities to avoid rate limiting
      await sleep(300 + Math.random() * 700);
    }
  }

  if (jobs.length === 0) {
    // Log raw HTML snippet for debugging when scraper returns 0
    await logLinkedInFailure(queries[0]?.keyword || "unknown");

    if (process.env.RAPIDAPI_KEY) {
      console.warn("[LinkedIn] HTML returned 0 jobs — falling back to JSearch");
      const fallback = await fetchJSearch(queries, 8);
      return fallback;
    }
  }

  console.log(`[LinkedIn] Total scraped: ${jobs.length} jobs`);
  return jobs;
}

/** Log raw HTML response for debugging when LinkedIn returns 0 results */
async function logLinkedInFailure(keyword: string) {
  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&start=0&f_TPR=r86400&sortBy=DD`;
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": ua, ...ACCEPT_HEADERS },
    });
    const html = await res.text();
    const snippet = html.slice(0, 5000);

    // Determine failure type
    let failureType = "unknown";
    if (html.includes("captcha") || html.includes("authwall")) {
      failureType = "captcha/authwall";
    } else if (html.includes("base-search-card") || html.includes("job-card")) {
      failureType = "selectors_mismatch (HTML has cards but selectors don't match)";
    } else if (res.status >= 400) {
      failureType = `http_${res.status}`;
    } else if (html.length < 200) {
      failureType = "empty_response";
    }

    console.warn(`[LinkedIn] Failure type: ${failureType}. HTML snippet (first 500 chars): ${snippet.slice(0, 500)}`);

    // Try to log to SystemLog if prisma is available
    const { prisma } = await import("@/lib/prisma");
    await prisma.systemLog.create({
      data: {
        type: "error",
        source: "linkedin",
        message: `LinkedIn scraper returned 0 jobs. Failure type: ${failureType}`,
        metadata: {
          failureType,
          httpStatus: res.status,
          htmlSnippet: snippet,
          keyword,
        },
      },
    }).catch((logErr) => console.warn("[LinkedIn] Failed to write failure log:", logErr));
  } catch (e) {
    console.warn("[LinkedIn] Could not log failure HTML:", e);
  }
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
