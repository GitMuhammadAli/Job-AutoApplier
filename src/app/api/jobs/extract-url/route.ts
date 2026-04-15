import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { GENERIC, JOBS, VALIDATION } from "@/lib/messages";

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    await getAuthUserId();
  } catch {
    return NextResponse.json({ error: GENERIC.UNAUTHORIZED }, { status: 401 });
  }

  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: VALIDATION.URL_REQUIRED }, { status: 400 });
  }

  try {
    const result = await extractJobFromUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ExtractURL] Error:", err);
    return NextResponse.json(
      { error: JOBS.EXTRACT_URL_FAILED },
      { status: 500 },
    );
  }
}

interface ExtractedJob {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  email: string | null;
  applyUrl: string;
  source: string;
}

async function extractJobFromUrl(url: string): Promise<ExtractedJob> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Fetch the page
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { title: null, company: null, location: null, description: null, salary: null, jobType: null, email: null, applyUrl: url, source: detectSource(hostname) };
    }

    const html = await res.text();
    clearTimeout(timeout);

    // Route to source-specific parser
    if (hostname.includes("linkedin.com")) {
      if (url.includes("/jobs/view/")) return parseLinkedInJob(html, url);
      if (url.includes("/posts/")) return parseLinkedInPost(html, url);
    }

    // Generic extraction for any page
    return parseGenericPage(html, url, hostname);
  } finally {
    clearTimeout(timeout);
  }
}

function detectSource(hostname: string): string {
  if (hostname.includes("linkedin")) return "linkedin";
  if (hostname.includes("indeed")) return "indeed";
  if (hostname.includes("rozee")) return "rozee";
  if (hostname.includes("glassdoor")) return "glassdoor";
  return "manual";
}

function parseLinkedInJob(html: string, url: string): ExtractedJob {
  const title = extractMeta(html, "og:title") || extractTag(html, "h1");
  const company = extractClass(html, "topcard__org-name-link") ||
    extractClass(html, "sub-nav-cta__optional-url") ||
    extractMeta(html, "og:title")?.split(" hiring ")?.shift() || null;
  const location = extractClass(html, "topcard__flavor--bullet") ||
    extractClass(html, "job-search-card__location") || null;
  const description = extractClass(html, "description__text") ||
    extractMeta(html, "og:description") || null;

  return {
    title: cleanText(title),
    company: cleanText(company),
    location: cleanText(location),
    description: cleanText(description),
    salary: extractSalaryFromText(html),
    jobType: extractJobTypeFromText(html),
    email: extractEmailFromText(html),
    applyUrl: url,
    source: "linkedin",
  };
}

function parseLinkedInPost(html: string, url: string): ExtractedJob {
  // LinkedIn posts: extract author as company, post text as description
  const postText = extractMeta(html, "og:description") ||
    extractClass(html, "attributed-text-segment-list__content") || "";
  const author = extractMeta(html, "og:title")?.split(" on LinkedIn")?.shift() || null;

  // Try to parse job title from post text
  const titleMatch = postText.match(
    /(?:hiring|looking for|opening for|position)\s*[-:–]?\s*((?:junior|senior|mid|lead|staff)?\s*[\w.#+/-]+\s+(?:developer|engineer|designer|analyst|manager|architect))/i,
  );
  const title = titleMatch ? titleMatch[1].trim() : null;

  return {
    title,
    company: author ? cleanText(author) : null,
    location: extractLocationFromText(postText),
    description: cleanText(postText),
    salary: extractSalaryFromText(postText),
    jobType: extractJobTypeFromText(postText),
    email: extractEmailFromText(postText),
    applyUrl: url,
    source: "linkedin_posts",
  };
}

function parseGenericPage(html: string, url: string, hostname: string): ExtractedJob {
  const title = extractMeta(html, "og:title") || extractTag(html, "h1") || extractTag(html, "title");
  const description = extractMeta(html, "og:description") || extractTag(html, "meta[name=description]") || null;
  const fullText = stripHtml(html);

  return {
    title: cleanText(title),
    company: extractMeta(html, "og:site_name") || hostname.replace("www.", "").split(".")[0] || null,
    location: extractLocationFromText(fullText.slice(0, 5000)),
    description: cleanText(description),
    salary: extractSalaryFromText(fullText.slice(0, 5000)),
    jobType: extractJobTypeFromText(fullText.slice(0, 3000)),
    email: extractEmailFromText(fullText.slice(0, 5000)),
    applyUrl: url,
    source: detectSource(hostname),
  };
}

// ── Helpers ──

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, "i");
  const match = html.match(re);
  if (match) return match[1];
  // Reverse order: content before property
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`, "i");
  const match2 = html.match(re2);
  return match2 ? match2[1] : null;
}

function extractTag(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(re);
  return match ? stripHtml(match[1]).trim() : null;
}

function extractClass(html: string, className: string): string | null {
  const re = new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i");
  const match = html.match(re);
  return match ? stripHtml(match[1]).trim() : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function extractEmailFromText(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
}

function extractSalaryFromText(text: string): string | null {
  const match = text.match(
    /(?:PKR|Rs\.?|USD|\$|salary[:.\s])\s*[\d,]+(?:\s*[-–]\s*(?:PKR|Rs\.?|USD|\$)?\s*[\d,]+)?(?:\s*\/\s*(?:month|mo|year|yr|hr|hour))?/i,
  );
  return match ? match[0].trim() : null;
}

function extractJobTypeFromText(text: string): string | null {
  if (/\bfull[\s-]?time\b/i.test(text)) return "full-time";
  if (/\bpart[\s-]?time\b/i.test(text)) return "part-time";
  if (/\b(?:contract|freelance)\b/i.test(text)) return "contract";
  if (/\b(?:internship|intern)\b/i.test(text)) return "internship";
  return null;
}

function extractLocationFromText(text: string): string | null {
  const cities = [
    "lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "peshawar",
    "multan", "quetta", "hyderabad", "sialkot", "gujranwala", "remote",
  ];
  const lower = text.toLowerCase();
  const found = cities.find((c) => lower.includes(c));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);

  const locationMatch = text.match(/(?:location|based in|office in)\s*[:]\s*([A-Za-z\s,]+)/i);
  return locationMatch ? locationMatch[1].trim() : null;
}
