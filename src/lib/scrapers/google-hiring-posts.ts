import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";
import { extractEmailFromText } from "@/lib/extract-email-from-text";
import { TIMEOUTS } from "@/lib/constants";
import { logApiCall } from "@/lib/api-usage-logger";

/**
 * Google Hiring Posts Scraper
 *
 * Finds informal job postings from LinkedIn posts, Twitter, and Facebook
 * that are indexed by Google. Catches jobs posted as social media posts
 * rather than formal job listings — critical in markets like Pakistan
 * where 30-40% of hiring happens via LinkedIn posts.
 *
 * Data sources (in priority order):
 * 1. Google Custom Search API (free: 100 queries/day, set GOOGLE_CSE_KEY + GOOGLE_CSE_ID)
 * 2. SerpAPI (paid fallback, set SERPAPI_KEY)
 *
 * Setup for free Google CSE:
 * 1. Go to https://programmablesearchengine.google.com → create engine
 * 2. Set "Sites to search" = linkedin.com/posts/*
 * 3. Copy the Search Engine ID → GOOGLE_CSE_ID
 * 4. Go to Google Cloud Console → APIs → enable "Custom Search API"
 * 5. Create API key → GOOGLE_CSE_KEY
 */

const HIRING_TERMS = [
  "hiring",
  "we are hiring",
  "looking for",
  "join our team",
  "job opening",
  "open position",
  "apply now",
];

interface SearchResult {
  title?: string;
  link?: string;
  snippet?: string;
  htmlSnippet?: string;
  date?: string;
  pagemap?: {
    metatags?: Array<Record<string, string>>;
  };
}

/**
 * Fetch results from Google Custom Search API (free tier: 100/day).
 * CSE should be configured to search linkedin.com/posts.
 * dateRestrict=d3 captures recent posts (Google indexes with 1-2 day lag).
 */
async function fetchGoogleCSE(
  query: string,
): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=10&dateRestrict=d3&sort=date`;

  const res = await fetchWithRetry(url);
  await logApiCall("google_cse");
  if (!res.ok) {
    if (res.status === 429) {
      console.warn("[GoogleHiringPosts] CSE daily quota exhausted");
    } else {
      console.warn(`[GoogleHiringPosts] CSE HTTP ${res.status}`);
    }
    return [];
  }

  const data = await res.json();
  const items = data?.items || [];

  return items.map((item: {
    title?: string;
    link?: string;
    snippet?: string;
    htmlSnippet?: string;
    pagemap?: { metatags?: Array<Record<string, string>> };
  }) => ({
    title: item.title || undefined,
    link: item.link || undefined,
    snippet: item.snippet || undefined,
    htmlSnippet: item.htmlSnippet || undefined,
    date: item.pagemap?.metatags?.[0]?.["article:published_time"] || undefined,
    pagemap: item.pagemap || undefined,
  }));
}

/**
 * Fetch results from SerpAPI (paid fallback).
 * Uses qdr:d3 (past 3 days) for fresh coverage.
 */
async function fetchSerpAPI(
  query: string,
): Promise<SearchResult[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=20&tbs=qdr:d3&api_key=${key}`;

  const res = await fetchWithRetry(url);
  await logApiCall("serpapi");
  if (!res.ok) return [];

  const data = await res.json();
  return (data?.organic_results || []) as SearchResult[];
}

export async function fetchGoogleHiringPosts(
  queries: SearchQuery[],
  maxQueries = 6,
): Promise<ScrapedJob[]> {
  const startTime = Date.now();
  const deadline = startTime + TIMEOUTS.SCRAPER_DEADLINE_MS;
  const hasCSE = !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_ID);
  const hasSerpAPI = !!process.env.SERPAPI_KEY;

  if (!hasCSE && !hasSerpAPI) {
    console.warn("[GoogleHiringPosts] No API key configured (set GOOGLE_CSE_KEY+GOOGLE_CSE_ID or SERPAPI_KEY)");
    return [];
  }

  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  // Build search queries — keyword-only first (global reach), then keyword+city
  const MAX_KEYWORDS = 5;
  const searchEntries: Array<{ query: string; fallbackCity: string }> = [];

  const topKeywords = queries.slice(0, MAX_KEYWORDS);

  // Strategy 1: keyword-only queries (broadest — catches remote/global posts)
  for (const q of topKeywords) {
    const term = HIRING_TERMS[searchEntries.length % HIRING_TERMS.length];
    searchEntries.push({
      query: `site:linkedin.com/posts "${term}" ${q.keyword}`,
      fallbackCity: "Remote",
    });
  }

  // Strategy 2: keyword+city for users' non-remote cities (local hiring posts)
  for (const q of topKeywords) {
    const realCities = q.cities.filter((c) => c.toLowerCase() !== "remote");
    if (realCities.length > 0) {
      const city = realCities[0];
      searchEntries.push({
        query: `site:linkedin.com/posts hiring ${q.keyword} ${city}`,
        fallbackCity: city,
      });
    }
  }

  const entriesToRun = searchEntries.slice(0, maxQueries);
  let cseExhausted = false;

  console.log(`[HiringPosts] Running ${entriesToRun.length} queries (${topKeywords.length} keywords)`);

  for (const entry of entriesToRun) {
    if (Date.now() >= deadline) break;

    try {
      let results: SearchResult[] = [];

      if (hasCSE && !cseExhausted) {
        results = await fetchGoogleCSE(entry.query);
        if (results.length === 0 && hasSerpAPI && Date.now() < deadline) {
          results = await fetchSerpAPI(entry.query);
          if (results.length > 0) cseExhausted = true;
        }
      } else if (hasSerpAPI) {
        results = await fetchSerpAPI(entry.query);
      }

      for (const r of results) {
        const parsed = parseHiringPost(r, entry.fallbackCity, seen);
        if (parsed) jobs.push(parsed);
      }
    } catch (err) {
      console.warn(`[GoogleHiringPosts] Failed for query "${entry.query}":`, err);
    }
  }

  console.debug(`[GoogleHiringPosts] Total found: ${jobs.length} hiring posts in ${Date.now() - startTime}ms`);
  return jobs;
}

function parseHiringPost(
  result: SearchResult,
  fallbackCity: string,
  seen: Set<string>,
): ScrapedJob | null {
  if (!result.title || !result.link) return null;

  // Skip non-hiring results
  const titleLower = result.title.toLowerCase();
  const snippetLower = (result.snippet || "").toLowerCase();
  const combined = `${titleLower} ${snippetLower}`;
  const hiringSignals = ["hiring", "we are hiring", "looking for", "join our team", "job opening", "vacancy", "position open"];
  if (!hiringSignals.some((s) => combined.includes(s))) return null;

  // Only keep linkedin.com/posts links
  if (!result.link.includes("linkedin.com/posts")) return null;

  // Parse company and job title from result title
  // LinkedIn format: "CompanyName on LinkedIn: 🚀 We Are Hiring – Junior MERN Developer"
  const { company, title } = parsePostTitle(result.title);
  if (!title || !company) return null;

  // Build sourceId for dedup
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
  const companySlug = company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  const sourceId = `hiring-post-${titleSlug}-${companySlug}`;
  if (seen.has(sourceId)) return null;
  seen.add(sourceId);

  // Extract location from snippet
  const location = extractLocation(result.snippet || "", fallbackCity);

  // Extract email from all available text fields for wider coverage
  const combinedText = [
    result.title,
    result.snippet,
    result.htmlSnippet?.replace(/<[^>]*>/g, " "),
    result.pagemap?.metatags?.[0]?.["og:description"],
    result.pagemap?.metatags?.[0]?.["description"],
    result.pagemap?.metatags?.[0]?.["og:title"],
  ].filter(Boolean).join(" ");
  const emailExtraction = extractEmailFromText(combinedText);
  const email = emailExtraction.email;

  // Extract job type
  const jobType = extractJobType(combined);

  // Parse posted date from Google's date field
  const postedDate = result.date ? parseGoogleDate(result.date) : null;

  // Use the richer combinedText as description if it's longer than just the snippet
  const richDescription = combinedText.length > (result.snippet?.length ?? 0)
    ? combinedText.replace(/\s+/g, " ").trim()
    : (result.snippet || null);

  return {
    title,
    company,
    location,
    description: richDescription,
    salary: extractSalary(combined),
    jobType,
    experienceLevel: extractExperienceLevel(combined),
    category: categorizeJob(title, [], richDescription || ""),
    skills: [],
    postedDate,
    source: "linkedin_posts",
    sourceId,
    sourceUrl: result.link,
    applyUrl: email ? `mailto:${email}` : result.link,
    companyUrl: null,
    companyEmail: email,
    // Hiring posts are high-quality sources — override confidence to 90
    ...(email ? { emailConfidence: 90, emailSource: "hiring_post" } : {}),
  };
}

function parsePostTitle(rawTitle: string): { company: string; title: string } {
  // "CompanyName on LinkedIn: 🚀 We Are Hiring – Junior MERN Developer"
  const linkedinMatch = rawTitle.match(/^(.+?)\s+on\s+LinkedIn:\s*(.+)$/i);
  if (linkedinMatch) {
    const company = linkedinMatch[1].trim();
    let postText = linkedinMatch[2].trim();

    // Remove emojis and common prefixes
    postText = postText
      .replace(/[^\x00-\x7F]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^(we are hiring|hiring|now hiring|job alert|job opening)\s*[-:–]\s*/i, "")
      .replace(/^[-:!]\s*/, "")
      .trim();

    // If the remaining text is a job title (short enough), use it
    if (postText.length > 3 && postText.length < 100) {
      return { company, title: postText };
    }
    // Fallback: try to extract job role from the text
    const roleMatch = postText.match(/((?:junior|senior|mid|lead|staff|principal|intern)?\s*(?:[\w.#+/-]+\s+){0,3}(?:developer|engineer|designer|analyst|manager|architect|devops|consultant|specialist|coordinator|intern))/i);
    if (roleMatch) return { company, title: roleMatch[1].trim() };
    return { company, title: postText.slice(0, 80) };
  }

  // Twitter format: "username on X: We're hiring a React Developer..."
  const twitterMatch = rawTitle.match(/^(.+?)\s+on\s+(?:X|Twitter):\s*(.+)$/i);
  if (twitterMatch) {
    const company = twitterMatch[1].trim();
    const text = twitterMatch[2].trim();
    const roleMatch = text.match(/((?:junior|senior|mid|lead|staff|principal|intern)?\s*(?:[\w.#+/-]+\s+){0,3}(?:developer|engineer|designer|analyst|manager|architect|devops|consultant|specialist|coordinator|intern))/i);
    if (roleMatch) return { company, title: roleMatch[1].trim() };
    return { company, title: text.slice(0, 80) };
  }

  // Generic: try to extract from any format
  const genericRole = rawTitle.match(/((?:junior|senior|mid|lead|staff|principal|intern)?\s*(?:[\w.#+/-]+\s+){0,3}(?:developer|engineer|designer|analyst|manager|architect|devops|consultant|specialist|coordinator|intern))/i);
  if (genericRole) {
    const company = rawTitle.replace(genericRole[0], "").replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).slice(0, 3).join(" ") || "Unknown";
    return { company, title: genericRole[1].trim() };
  }

  return { company: "", title: "" };
}

function extractLocation(text: string, fallback: string): string {
  const locationPatterns = [
    /(?:location|based in|office in|work from)\s*[:]\s*([A-Za-z\s,]+)/i,
    /\b(lahore|karachi|islamabad|rawalpindi|faisalabad|peshawar|multan|quetta|hyderabad|sialkot|gujranwala)\b/i,
    /\b(remote|onsite|on-site|hybrid)\b/i,
  ];
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return fallback;
}

function extractJobType(text: string): string | null {
  if (/\b(full[\s-]?time)\b/i.test(text)) return "full-time";
  if (/\b(part[\s-]?time)\b/i.test(text)) return "part-time";
  if (/\b(contract|freelance)\b/i.test(text)) return "contract";
  if (/\b(internship|intern)\b/i.test(text)) return "internship";
  return null;
}

function extractExperienceLevel(text: string): string | null {
  if (/\b(intern|internship)\b/i.test(text)) return "internship";
  if (/\b(junior|entry[\s-]?level|fresh|graduate)\b/i.test(text)) return "entry";
  if (/\b(mid[\s-]?level|2-5\s*years?|3-5\s*years?)\b/i.test(text)) return "mid";
  if (/\b(senior|sr\.?|5\+\s*years?|lead)\b/i.test(text)) return "senior";
  return null;
}

function extractSalary(text: string): string | null {
  const match = text.match(
    /(?:PKR|Rs\.?|USD|\$|salary)\s*[\d,]+\s*(?:[-–]\s*(?:PKR|Rs\.?|USD|\$)?\s*[\d,]+)?(?:\s*\/\s*(?:month|mo|year|yr|hr|hour))?/i,
  );
  return match ? match[0].trim() : null;
}

function parseGoogleDate(dateStr: string): Date | null {
  const now = new Date();
  const match = dateStr.match(/(\d+)\s*(hour|minute|day|week|month)/i);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("minute")) now.setMinutes(now.getMinutes() - num);
    else if (unit.startsWith("hour")) now.setHours(now.getHours() - num);
    else if (unit.startsWith("day")) now.setDate(now.getDate() - num);
    else if (unit.startsWith("week")) now.setDate(now.getDate() - num * 7);
    else if (unit.startsWith("month")) now.setMonth(now.getMonth() - num);
    return now;
  }
  // Try ISO date
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}
