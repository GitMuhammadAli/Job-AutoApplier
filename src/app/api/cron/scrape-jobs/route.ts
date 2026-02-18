import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Experience level filter patterns ──
const EXP_FILTERS: Record<string, { skip: RegExp[]; boost: RegExp[] }> = {
  JUNIOR: {
    skip: [/\bsenior\b/i, /\blead\b/i, /\bprincipal\b/i, /\b[5-9]\+?\s*years?\b/i, /\b1[0-9]\+?\s*years?\b/i],
    boost: [/\bjunior\b/i, /\bentry\s*level\b/i, /\bintern\b/i, /\b[0-2]\+?\s*years?\b/i, /\bfresher\b/i],
  },
  MID: {
    skip: [/\bprincipal\b/i, /\b[8-9]\+?\s*years?\b/i, /\b1[0-9]\+?\s*years?\b/i],
    boost: [/\bmid\b/i, /\b[2-5]\+?\s*years?\b/i],
  },
  SENIOR: {
    skip: [/\bjunior\b/i, /\bintern\b/i, /\bentry\s*level\b/i, /\bfresher\b/i],
    boost: [/\bsenior\b/i, /\blead\b/i, /\b[5-9]\+?\s*years?\b/i],
  },
  LEAD: {
    skip: [/\bjunior\b/i, /\bintern\b/i, /\bfresher\b/i],
    boost: [/\blead\b/i, /\bprincipal\b/i, /\bstaff\b/i, /\barchitect\b/i, /\bhead\s*of\b/i],
  },
};

// ── Category keyword patterns ──
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Full-Stack": ["full stack", "fullstack", "full-stack", "mern", "mean"],
  Backend: ["backend", "back-end", "server-side", "api", "microservice", "nestjs", "express", "django", "flask", "spring", "laravel"],
  Frontend: ["frontend", "front-end", "react", "vue", "angular", "ui developer", "css", "tailwind"],
  Mobile: ["mobile", "react native", "flutter", "ios", "android", "swift", "kotlin", "expo"],
  DevOps: ["devops", "sre", "infrastructure", "docker", "kubernetes", "ci/cd", "terraform", "aws", "cloud engineer"],
  "Software Engineer": ["software engineer", "swe", "sde", "developer", "programmer", "coder"],
  "Data Engineering": ["data engineer", "etl", "pipeline", "spark", "airflow", "data platform"],
  "Machine Learning": ["machine learning", "ml engineer", "ai engineer", "deep learning", "nlp", "data scientist"],
  "AI / GenAI": ["artificial intelligence", "generative ai", "llm", "chatgpt", "openai", "langchain", "rag", "genai"],
  "QA / Testing": ["qa", "quality assurance", "test engineer", "automation test", "sdet"],
  "UI/UX Design": ["ui/ux", "ux designer", "ui designer", "product design", "figma"],
  Cybersecurity: ["security engineer", "cybersecurity", "penetration", "infosec", "soc analyst"],
  "Cloud / Infrastructure": ["cloud", "aws", "azure", "gcp", "infrastructure", "platform engineer"],
  "Blockchain / Web3": ["blockchain", "web3", "solidity", "smart contract", "crypto", "defi"],
  "Embedded / IoT": ["embedded", "firmware", "iot", "microcontroller", "rtos", "arduino", "fpga"],
  "Game Development": ["game developer", "unity", "unreal", "gamedev", "game engine", "game designer"],
  "Database / SQL": ["database", "dba", "sql", "postgresql", "mysql", "mongodb", "redis", "database admin"],
  "Network Engineering": ["network engineer", "cisco", "routing", "switching", "network admin", "ccna"],
  "Technical Support": ["technical support", "it support", "helpdesk", "service desk", "desktop support"],
  "IT / System Admin": ["system admin", "sysadmin", "linux admin", "windows server", "active directory"],
  "Product Management": ["product manager", "product owner", "pm", "roadmap", "product lead"],
  "Scrum Master / Agile": ["scrum master", "agile coach", "project manager", "jira", "kanban"],
  "WordPress / CMS": ["wordpress", "cms", "drupal", "shopify", "woocommerce", "elementor"],
  "ERP / SAP": ["erp", "sap", "oracle erp", "dynamics 365", "sap abap", "sap hana"],
  Salesforce: ["salesforce", "sfdc", "apex", "lightning", "salesforce admin", "salesforce developer"],
  Python: ["python", "django", "flask", "fastapi", "pandas", "numpy"],
  Java: ["java", "spring boot", "spring", "j2ee", "hibernate", "maven"],
  "JavaScript / TypeScript": ["javascript", "typescript", "node.js", "nodejs", "react", "next.js", "vue", "angular"],
  "C# / .NET": ["c#", "csharp", ".net", "dotnet", "asp.net", "blazor", "unity"],
  "PHP / Laravel": ["php", "laravel", "symfony", "codeigniter", "wordpress"],
  "Ruby / Rails": ["ruby", "rails", "ruby on rails", "sinatra"],
  Rust: ["rust", "rustlang", "cargo", "tokio", "wasm"],
  "Go / Golang": ["go", "golang", "gin", "goroutine"],
  "Swift / iOS": ["swift", "ios", "swiftui", "xcode", "cocoapods", "ios developer"],
  "Kotlin / Android": ["kotlin", "android", "jetpack compose", "android studio", "android developer"],
};

interface ResumeWithContent {
  id: string;
  name: string;
  fileUrl: string | null;
  content: string | null;
}

interface UserProfile {
  skills: string[];
  keywords: string[];
  experienceLevel: string | null;
  jobCategories: string[];
  preferredWorkType: string | null;
  minSalary: number | null;
  maxSalary: number | null;
}

function extractSkillsFromContent(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[,\n;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40);
}

function smartRecommendResume(
  title: string,
  desc: string,
  resumes: ResumeWithContent[],
): { name: string; id: string | null; matchedSkills: string[] } {
  const jobText = (title + " " + desc).toLowerCase();
  let bestResume = { name: "General", id: null as string | null, matchedSkills: [] as string[] };
  let bestScore = 0;

  for (const resume of resumes) {
    if (!resume.content) continue;
    const resumeSkills = extractSkillsFromContent(resume.content);
    const matched = resumeSkills.filter((skill) => jobText.includes(skill));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      bestResume = { name: resume.name, id: resume.id, matchedSkills: matched.slice(0, 8) };
    }
  }

  // Fallback: name-based matching if no content-based match
  if (bestScore === 0) {
    const fallbackMap: Record<string, string[]> = {
      "Full-Stack": ["full stack", "fullstack", "mern"],
      Backend: ["backend", "node", "nestjs", "express", "api"],
      Frontend: ["frontend", "react", "vue", "angular"],
      MERN: ["mern", "mongodb"],
      TypeScript: ["typescript"],
      DevOps: ["devops", "docker", "kubernetes"],
    };
    for (const resume of resumes) {
      const kws = fallbackMap[resume.name] || [];
      const score = kws.filter((kw) => jobText.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestResume = { name: resume.name, id: resume.id, matchedSkills: [] };
      }
    }
  }

  return bestResume;
}

function smartMatchScore(title: string, desc: string, profile: UserProfile): number {
  const jobText = (title + " " + desc).toLowerCase();
  let score = 0;
  let maxPossible = 0;

  // Skills matching (weight: 3 per skill)
  if (profile.skills.length > 0) {
    const skillMatches = profile.skills.filter((s) => jobText.includes(s.toLowerCase()));
    score += skillMatches.length * 3;
    maxPossible += profile.skills.length * 3;
  }

  // Keyword matching (weight: 2 per keyword)
  if (profile.keywords.length > 0) {
    const kwMatches = profile.keywords.filter((kw) => jobText.includes(kw.toLowerCase()));
    score += kwMatches.length * 2;
    maxPossible += profile.keywords.length * 2;
  }

  // Category matching (weight: bonus 10)
  if (profile.jobCategories.length > 0) {
    const catMatch = profile.jobCategories.some((cat) => {
      const catKws = CATEGORY_KEYWORDS[cat] || [];
      return catKws.some((kw) => jobText.includes(kw));
    });
    if (catMatch) score += 10;
    maxPossible += 10;
  }

  // Experience level boost (weight: bonus 5)
  if (profile.experienceLevel && profile.experienceLevel !== "ANY") {
    const expConfig = EXP_FILTERS[profile.experienceLevel];
    if (expConfig) {
      const hasBoost = expConfig.boost.some((r) => r.test(title + " " + desc));
      if (hasBoost) score += 5;
      maxPossible += 5;
    }
  }

  if (maxPossible === 0) return 0;
  return Math.min(Math.round((score / maxPossible) * 100), 100);
}

function shouldFilterOut(job: { role: string; description: string; workType: string }, profile: UserProfile): boolean {
  const text = job.role + " " + job.description;

  // Experience filter -- skip mismatched levels
  if (profile.experienceLevel && profile.experienceLevel !== "ANY") {
    const expConfig = EXP_FILTERS[profile.experienceLevel];
    if (expConfig && expConfig.skip.some((r) => r.test(text))) {
      return true;
    }
  }

  // Work type filter -- skip if user wants remote but job is onsite (soft filter: only if explicitly set)
  if (profile.preferredWorkType) {
    if (profile.preferredWorkType === "REMOTE" && job.workType === "ONSITE") return true;
    if (profile.preferredWorkType === "ONSITE" && job.workType === "REMOTE") return true;
  }

  return false;
}

// ── Normalized job shape from all sources ──
interface RawJob {
  company: string;
  role: string;
  url: string;
  platform: "LINKEDIN" | "INDEED" | "OTHER";
  location: string;
  salary: string | null;
  description: string;
  applyType: "EASY_APPLY" | "QUICK_APPLY" | "REGULAR" | "EMAIL" | "UNKNOWN";
  isDirectApply: boolean;
  applyOptions: Array<{ link: string; source: string }>;
  workType: "REMOTE" | "ONSITE" | "HYBRID";
  source: string;
}

// ── 1. JSearch (RapidAPI) ──
async function fetchJSearch(
  keywords: string[],
  location: string,
): Promise<RawJob[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.log("RAPIDAPI_KEY not set, skipping JSearch");
    return [];
  }

  const jobs: RawJob[] = [];
  // Use max 3 keywords to stay within free tier limits
  for (const kw of keywords.slice(0, 3)) {
    try {
      const query = encodeURIComponent(`${kw} developer in ${location}`);
      const res = await fetch(
        `https://jsearch.p.rapidapi.com/search?query=${query}&num_pages=1&date_posted=today`,
        {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!res.ok) {
        console.log(`JSearch failed for "${kw}": ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) continue;

      for (const item of data.data) {
        const isDirect = item.job_apply_is_direct === true;
        const applyLink = item.job_apply_link || "";
        const options: Array<{ link: string; source: string }> = [];

        if (applyLink) options.push({ link: applyLink, source: "direct" });
        if (Array.isArray(item.apply_options)) {
          for (const opt of item.apply_options) {
            if (opt.apply_link && opt.publisher) {
              options.push({ link: opt.apply_link, source: opt.publisher });
            }
          }
        }

        let applyType: RawJob["applyType"] = "REGULAR";
        if (isDirect) applyType = "EASY_APPLY";
        else if (
          options.some((o) => o.source.toLowerCase().includes("linkedin"))
        )
          applyType = "QUICK_APPLY";

        const isRemote =
          item.job_is_remote === true ||
          (item.job_title || "").toLowerCase().includes("remote") ||
          (item.job_city || "").toLowerCase() === "remote";

        jobs.push({
          company: item.employer_name || "Unknown",
          role: item.job_title || "",
          url: applyLink || item.job_google_link || "",
          platform: "LINKEDIN",
          location:
            [item.job_city, item.job_state, item.job_country]
              .filter(Boolean)
              .join(", ") || location,
          salary:
            item.job_min_salary && item.job_max_salary
              ? `${item.job_salary_currency || "$"}${item.job_min_salary}-${item.job_max_salary}/${item.job_salary_period || "year"}`
              : null,
          description: (item.job_description || "").substring(0, 2000),
          applyType,
          isDirectApply: isDirect,
          applyOptions: options,
          workType: isRemote ? "REMOTE" : "ONSITE",
          source: "jsearch",
        });
      }
    } catch (err) {
      console.error(`JSearch error for "${kw}":`, err);
    }
  }
  return jobs;
}

// ── 2. Indeed RSS ──
async function fetchIndeedRSS(
  keywords: string[],
  location: string,
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const feeds = keywords.slice(0, 5).map((kw) => {
    const q = encodeURIComponent(kw.toLowerCase() + " developer");
    const l = encodeURIComponent(location);
    return `https://pk.indeed.com/rss?q=${q}&l=${l}&sort=date`;
  });

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (JobPilot RSS Reader)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const title = content.match(
          /<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/,
        );
        const link = content.match(/<link>([\s\S]*?)<\/link>/);
        const desc = content.match(
          /<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/,
        );
        const source = content.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/);

        const role = (title?.[1] || title?.[2] || "")
          .replace(/<[^>]*>/g, "")
          .trim();
        const url = (link?.[1] || "").trim();
        const description = (desc?.[1] || desc?.[2] || "")
          .replace(/<[^>]*>/g, "")
          .trim();
        const company = (source?.[1] || "Unknown")
          .replace(/<[^>]*>/g, "")
          .trim();

        if (role && url) {
          jobs.push({
            company,
            role,
            url,
            platform: "INDEED",
            location,
            salary: null,
            description: description.substring(0, 2000),
            applyType: "UNKNOWN",
            isDirectApply: false,
            applyOptions: [{ link: url, source: "indeed" }],
            workType: role.toLowerCase().includes("remote")
              ? "REMOTE"
              : "ONSITE",
            source: "indeed_rss",
          });
        }
      }
    } catch {
      // Skip failed feeds
    }
  }
  return jobs;
}

// ── 3. Remotive.io ──
async function fetchRemotive(keywords: string[]): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  // Remotive rate limit: 2 req/min, so use only first 2 keywords
  for (const kw of keywords.slice(0, 2)) {
    try {
      const search = encodeURIComponent(kw.toLowerCase());
      const res = await fetch(
        `https://remotive.com/api/remote-jobs?search=${search}&limit=20`,
        {
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) continue;

      for (const item of data.jobs) {
        const url = item.url || "";
        if (!url) continue;

        jobs.push({
          company: item.company_name || "Unknown",
          role: item.title || "",
          url,
          platform: "OTHER",
          location: item.candidate_required_location || "Remote",
          salary: item.salary || null,
          description: (item.description || "")
            .replace(/<[^>]*>/g, "")
            .substring(0, 2000),
          applyType: "REGULAR",
          isDirectApply: false,
          applyOptions: [{ link: url, source: "remotive" }],
          workType: "REMOTE",
          source: "remotive",
        });
      }
    } catch (err) {
      console.error(`Remotive error for "${kw}":`, err);
    }
  }
  return jobs;
}

// ── 4. Arbeitnow ──
async function fetchArbeitnow(): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    for (const item of data.data.slice(0, 30)) {
      const url = item.url || "";
      if (!url) continue;

      const isRemote =
        item.remote === true ||
        (item.tags || []).some((t: string) =>
          t.toLowerCase().includes("remote"),
        );

      jobs.push({
        company: item.company_name || "Unknown",
        role: item.title || "",
        url,
        platform: "OTHER",
        location: item.location || "EU / Remote",
        salary: null,
        description: (item.description || "")
          .replace(/<[^>]*>/g, "")
          .substring(0, 2000),
        applyType: "REGULAR",
        isDirectApply: false,
        applyOptions: [{ link: url, source: "arbeitnow" }],
        workType: isRemote ? "REMOTE" : "ONSITE",
        source: "arbeitnow",
      });
    }
  } catch (err) {
    console.error("Arbeitnow error:", err);
  }
  return jobs;
}

async function fetchAdzuna(keywords: string[], location: string): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];
  const jobs: RawJob[] = [];
  for (const kw of keywords.slice(0, 3)) {
    try {
      const q = encodeURIComponent(kw);
      const l = encodeURIComponent(location);
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/pk/search/1?app_id=${appId}&app_key=${appKey}&what=${q}&where=${l}&results_per_page=15&sort_by=date`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) continue;
      for (const item of data.results) {
        const url = item.redirect_url || ""; if (!url) continue;
        const isRemote = (item.title || "").toLowerCase().includes("remote") || (item.location?.display_name || "").toLowerCase().includes("remote");
        jobs.push({
          company: item.company?.display_name || "Unknown", role: item.title || "", url, platform: "OTHER",
          location: item.location?.display_name || location,
          salary: item.salary_min && item.salary_max ? `${item.salary_min}-${item.salary_max}` : null,
          description: (item.description || "").substring(0, 2000), applyType: "REGULAR", isDirectApply: false,
          applyOptions: [{ link: url, source: "adzuna" }], workType: isRemote ? "REMOTE" : "ONSITE", source: "adzuna",
        });
      }
    } catch (err) { console.error(`Adzuna error for "${kw}":`, err); }
  }
  return jobs;
}

async function fetchLinkedInRSS(keywords: string[], location: string): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  for (const kw of keywords.slice(0, 2)) {
    try {
      const q = encodeURIComponent(kw);
      const l = encodeURIComponent(location);
      const res = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${q}&location=${l}&start=0`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const cardRegex = /<li[\s\S]*?<\/li>/g;
      let match;
      while ((match = cardRegex.exec(html)) !== null) {
        const card = match[0];
        const titleMatch = card.match(/class="base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\//);
        const companyMatch = card.match(/class="base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\//);
        const linkMatch = card.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/);
        const locationMatch = card.match(/class="job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\//);
        const role = (titleMatch?.[1] || "").replace(/<[^>]*>/g, "").trim();
        const company = (companyMatch?.[1] || "").replace(/<[^>]*>/g, "").trim();
        const url = (linkMatch?.[1] || "").trim();
        const loc = (locationMatch?.[1] || "").replace(/<[^>]*>/g, "").trim();
        if (role && url) {
          const isRemote = loc.toLowerCase().includes("remote") || role.toLowerCase().includes("remote");
          jobs.push({
            company: company || "Unknown", role, url, platform: "LINKEDIN", location: loc || location,
            salary: null, description: "", applyType: "QUICK_APPLY", isDirectApply: false,
            applyOptions: [{ link: url, source: "linkedin" }], workType: isRemote ? "REMOTE" : "ONSITE", source: "linkedin_rss",
          });
        }
      }
    } catch (err) { console.error(`LinkedIn RSS error for "${kw}":`, err); }
  }
  return jobs;
}

async function fetchRozeePk(keywords: string[], location: string): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const city = location.toLowerCase().replace(/\s+/g, "-");
  for (const kw of keywords.slice(0, 3)) {
    try {
      const q = encodeURIComponent(kw.toLowerCase());
      const res = await fetch(`https://www.rozee.pk/job/jsearch/q/${q}/fc/city:${city}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const jobRegex = /<div[^>]*class="[^"]*job[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
      let match;
      while ((match = jobRegex.exec(html)) !== null) {
        const block = match[0];
        const titleMatch = block.match(/<a[^>]*href="(\/job\/detail\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const companyMatch = block.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//);
        if (titleMatch) {
          const role = (titleMatch[2] || "").replace(/<[^>]*>/g, "").trim();
          const path = titleMatch[1];
          const url = `https://www.rozee.pk${path}`;
          const company = (companyMatch?.[1] || "").replace(/<[^>]*>/g, "").trim() || "Unknown";
          if (role) {
            jobs.push({
              company, role, url, platform: "OTHER", location,
              salary: null, description: "", applyType: "REGULAR", isDirectApply: false,
              applyOptions: [{ link: url, source: "rozee.pk" }], workType: "ONSITE", source: "rozee_pk",
            });
          }
        }
      }
    } catch (err) { console.error(`Rozee.pk error for "${kw}":`, err); }
  }
  return jobs;
}

async function fetchGoogleJobs(keywords: string[], location: string): Promise<RawJob[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];
  const jobs: RawJob[] = [];
  for (const kw of keywords.slice(0, 2)) {
    try {
      const q = encodeURIComponent(`${kw} developer`);
      const l = encodeURIComponent(location);
      const res = await fetch(`https://serpapi.com/search.json?engine=google_jobs&q=${q}&location=${l}&api_key=${apiKey}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs_results || !Array.isArray(data.jobs_results)) continue;
      for (const item of data.jobs_results) {
        const applyLinks: Array<{ link: string; source: string }> = [];
        if (Array.isArray(item.apply_options)) {
          for (const opt of item.apply_options) { if (opt.link) applyLinks.push({ link: opt.link, source: opt.title || "apply" }); }
        }
        const url = applyLinks[0]?.link || "";
        if (!url) continue;
        const isRemote = (item.location || "").toLowerCase().includes("remote") || (item.title || "").toLowerCase().includes("remote");
        const isDirect = applyLinks.some((o) => o.source.toLowerCase().includes("direct") || o.source.toLowerCase().includes("company"));
        jobs.push({
          company: item.company_name || "Unknown", role: item.title || "", url, platform: "OTHER",
          location: item.location || location,
          salary: item.detected_extensions?.salary || null,
          description: (item.description || "").substring(0, 2000),
          applyType: isDirect ? "EASY_APPLY" : "REGULAR", isDirectApply: isDirect,
          applyOptions: applyLinks, workType: isRemote ? "REMOTE" : "ONSITE", source: "google_jobs",
        });
      }
    } catch (err) { console.error(`Google Jobs error for "${kw}":`, err); }
  }
  return jobs;
}

// ── Main handler ──
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { settings: { isNot: null } },
      include: { settings: true, resumes: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No users with settings" });
    }

    const perUser: Record<string, unknown> = {};

    for (const user of users) {
      const settings = user.settings;
      const keywords = settings?.searchKeywords?.split(",").map((k) => k.trim()).filter(Boolean) ?? [];
      if (keywords.length === 0) { perUser[user.email || user.id] = { skipped: "No keywords" }; continue; }
      const location = settings?.searchLocation ?? "Remote";

      const profile: UserProfile = {
        skills: settings?.skills?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
        keywords,
        experienceLevel: settings?.experienceLevel ?? null,
        jobCategories: settings?.jobCategories?.split(",").filter(Boolean) ?? [],
        preferredWorkType: settings?.preferredWorkType ?? null,
        minSalary: settings?.minSalary ?? null,
        maxSalary: settings?.maxSalary ?? null,
      };

      const [jsearchJobs, indeedJobs, remotiveJobs, arbeitnowJobs, adzunaJobs, linkedinJobs, rozeeJobs, googleJobs] =
        await Promise.allSettled([
          fetchJSearch(keywords, location),
          fetchIndeedRSS(keywords, location),
          fetchRemotive(keywords),
          fetchArbeitnow(),
          fetchAdzuna(keywords, location),
          fetchLinkedInRSS(keywords, location),
          fetchRozeePk(keywords, location),
          fetchGoogleJobs(keywords, location),
        ]);

      const allJobs: RawJob[] = [
        ...(jsearchJobs.status === "fulfilled" ? jsearchJobs.value : []),
        ...(indeedJobs.status === "fulfilled" ? indeedJobs.value : []),
        ...(remotiveJobs.status === "fulfilled" ? remotiveJobs.value : []),
        ...(arbeitnowJobs.status === "fulfilled" ? arbeitnowJobs.value : []),
        ...(adzunaJobs.status === "fulfilled" ? adzunaJobs.value : []),
        ...(linkedinJobs.status === "fulfilled" ? linkedinJobs.value : []),
        ...(rozeeJobs.status === "fulfilled" ? rozeeJobs.value : []),
        ...(googleJobs.status === "fulfilled" ? googleJobs.value : []),
      ];

      const uniqueJobs = Array.from(
        new Map(allJobs.filter((j) => j.url).map((j) => [j.url, j])).values(),
      );

      const existingUrls = new Set(
        (await prisma.job.findMany({ where: { userId: user.id, url: { in: uniqueJobs.map((j) => j.url) } }, select: { url: true } })).map((j) => j.url),
      );

      const newJobs = uniqueJobs.filter((j) => !existingUrls.has(j.url));
      const filteredJobs = newJobs.filter(
        (job) => !shouldFilterOut({ role: job.role, description: job.description, workType: job.workType }, profile),
      );

      let savedCount = 0, emailsSent = 0;
      for (const job of filteredJobs.slice(0, 30)) {
        const matchScore = smartMatchScore(job.role, job.description, profile);
        const recommended = smartRecommendResume(job.role, job.description, user.resumes);
        const resume = recommended.id ? user.resumes.find((r) => r.id === recommended.id) : null;

        const created = await prisma.job.create({
          data: {
            company: job.company, role: job.role, url: job.url, platform: job.platform, stage: "SAVED",
            applyType: job.applyType, isDirectApply: job.isDirectApply,
            applyOptions: job.applyOptions.length > 0 ? job.applyOptions : undefined,
            matchScore, description: job.description || null, salary: job.salary,
            location: job.location, workType: job.workType, resumeId: resume?.id ?? null, userId: user.id,
          },
        });

        await prisma.activity.create({
          data: { jobId: created.id, type: "job_created", toStage: "SAVED", note: `Auto-scraped from ${job.source}`, metadata: { automated: true, source: job.source, matchScore, matchedSkills: recommended.matchedSkills } },
        });
        savedCount++;

        if (settings?.emailNotifications !== false && user.email) {
          try {
            await sendJobEmail({
              company: job.company, role: job.role, url: job.url, platform: job.platform,
              location: job.location, salary: job.salary, description: job.description,
              applyType: job.applyType, isDirectApply: job.isDirectApply, matchScore,
              recommendedResume: recommended.name, resumeFileUrl: resume?.fileUrl || null,
              matchedSkills: recommended.matchedSkills, source: job.source,
            }, user.email);
            emailsSent++;
          } catch (emailErr) { console.error(`Email failed for ${job.role}:`, emailErr); }
        }
      }
      perUser[user.email || user.id] = { scraped: uniqueJobs.length, saved: savedCount, emailsSent };
    }

    return NextResponse.json({ message: "Scrape completed", users: perUser });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Scrape cron error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
