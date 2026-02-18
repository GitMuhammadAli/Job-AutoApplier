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
  "Data Engineering": ["data engineer", "etl", "pipeline", "spark", "airflow", "data platform"],
  "Machine Learning": ["machine learning", "ml engineer", "ai engineer", "deep learning", "nlp", "data scientist"],
  "QA / Testing": ["qa", "quality assurance", "test engineer", "automation test", "sdet"],
  "UI/UX Design": ["ui/ux", "ux designer", "ui designer", "product design", "figma"],
  Cybersecurity: ["security engineer", "cybersecurity", "penetration", "infosec"],
  "Cloud / Infrastructure": ["cloud", "aws", "azure", "gcp", "infrastructure", "platform engineer"],
  Blockchain: ["blockchain", "web3", "solidity", "smart contract", "crypto"],
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

      const [jsearchJobs, indeedJobs, remotiveJobs, arbeitnowJobs] =
        await Promise.allSettled([
          fetchJSearch(keywords, location),
          fetchIndeedRSS(keywords, location),
          fetchRemotive(keywords),
          fetchArbeitnow(),
        ]);

      const allJobs: RawJob[] = [
        ...(jsearchJobs.status === "fulfilled" ? jsearchJobs.value : []),
        ...(indeedJobs.status === "fulfilled" ? indeedJobs.value : []),
        ...(remotiveJobs.status === "fulfilled" ? remotiveJobs.value : []),
        ...(arbeitnowJobs.status === "fulfilled" ? arbeitnowJobs.value : []),
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
