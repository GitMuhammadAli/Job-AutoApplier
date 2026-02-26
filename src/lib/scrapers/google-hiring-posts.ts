import type { ScrapedJob, SearchQuery } from "@/types";
import { fetchWithRetry } from "./fetch-with-retry";
import { categorizeJob } from "@/lib/job-categorizer";

/**
 * Google Hiring Posts Scraper
 *
 * Finds informal job postings from LinkedIn posts, Twitter, and Facebook
 * that are indexed by Google. Uses SerpAPI regular search (not Google Jobs).
 *
 * These catch 30-40% of jobs in markets like Pakistan where hiring happens
 * via social media posts rather than formal job listings.
 */

const SITE_QUERIES = [
  'site:linkedin.com/posts "hiring"',
  'site:linkedin.com/posts "we are hiring"',
  'site:linkedin.com/posts "looking for"',
];

export async function fetchGoogleHiringPosts(
  queries: SearchQuery[],
  maxQueries = 3,
): Promise<ScrapedJob[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();

  // Build search queries from user keywords + cities
  const searchPairs: Array<{ keyword: string; city: string }> = [];
  for (const q of queries.slice(0, 3)) {
    for (const city of q.cities.slice(0, 2)) {
      if (city.toLowerCase() === "remote") continue;
      searchPairs.push({ keyword: q.keyword, city });
    }
  }

  // Limit total API calls to stay within quota
  const pairs = searchPairs.slice(0, maxQueries);

  for (const { keyword, city } of pairs) {
    for (const siteQuery of SITE_QUERIES.slice(0, 1)) {
      try {
        const q = `${siteQuery} "${city}" "${keyword}"`;
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=20&tbs=qdr:d&api_key=${key}`;

        const res = await fetchWithRetry(url);
        if (!res.ok) continue;

        const data = await res.json();
        const results = data?.organic_results || [];

        for (const r of results) {
          const parsed = parseHiringPost(r, city, seen);
          if (parsed) jobs.push(parsed);
        }
      } catch (err) {
        console.warn(
          `[GoogleHiringPosts] Failed for "${keyword}" in "${city}":`,
          err,
        );
      }
    }
  }

  console.log(`[GoogleHiringPosts] Total found: ${jobs.length} hiring posts`);
  return jobs;
}

function parseHiringPost(
  result: {
    title?: string;
    link?: string;
    snippet?: string;
    date?: string;
  },
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

  // Extract email from snippet
  const email = extractEmail(result.snippet || "");

  // Extract job type
  const jobType = extractJobType(combined);

  // Parse posted date from Google's date field
  const postedDate = result.date ? parseGoogleDate(result.date) : null;

  return {
    title,
    company,
    location,
    description: result.snippet || null,
    salary: extractSalary(combined),
    jobType,
    experienceLevel: extractExperienceLevel(combined),
    category: categorizeJob(title, [], result.snippet || ""),
    skills: [],
    postedDate,
    source: "linkedin_posts",
    sourceId,
    sourceUrl: result.link,
    applyUrl: email ? `mailto:${email}` : result.link,
    companyUrl: null,
    companyEmail: email,
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
      .replace(/^(we are hiring|hiring|now hiring|job alert|job opening)\s*[-:]\s*/i, "")
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

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
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
