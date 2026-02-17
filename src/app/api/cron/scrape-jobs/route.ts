import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Resume keyword matching ──
const RESUME_KEYWORD_MAP: Record<string, string[]> = {
  "Full-Stack": ["full stack", "fullstack", "mern", "full-stack"],
  Backend: ["backend", "node", "nestjs", "express", "api", "django", "flask", "spring"],
  Frontend: ["frontend", "react", "vue", "angular", "ui", "ux", "css", "tailwind"],
  MERN: ["mern", "mongodb", "express", "react", "node"],
  TypeScript: ["typescript", "ts", "type-safe"],
  JavaScript: ["javascript", "js", "ecmascript"],
  "React Native": ["react native", "mobile", "ios", "android", "expo"],
  DevOps: ["devops", "docker", "kubernetes", "aws", "ci/cd", "terraform"],
};

function recommendResume(title: string, desc: string): string {
  const text = (title + " " + desc).toLowerCase();
  let bestMatch = "General";
  let bestScore = 0;
  for (const [resumeName, kws] of Object.entries(RESUME_KEYWORD_MAP)) {
    const score = kws.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = resumeName;
    }
  }
  return bestMatch;
}

function calcMatchScore(title: string, desc: string, keywords: string[]): number {
  const text = (title + " " + desc).toLowerCase();
  if (keywords.length === 0) return 0;
  const matched = keywords.filter((kw) => text.includes(kw.toLowerCase()));
  return Math.round((matched.length / keywords.length) * 100);
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
async function fetchJSearch(keywords: string[], location: string): Promise<RawJob[]> {
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
        }
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
        else if (options.some((o) => o.source.toLowerCase().includes("linkedin"))) applyType = "QUICK_APPLY";

        const isRemote =
          item.job_is_remote === true ||
          (item.job_title || "").toLowerCase().includes("remote") ||
          (item.job_city || "").toLowerCase() === "remote";

        jobs.push({
          company: item.employer_name || "Unknown",
          role: item.job_title || "",
          url: applyLink || item.job_google_link || "",
          platform: "LINKEDIN",
          location: [item.job_city, item.job_state, item.job_country].filter(Boolean).join(", ") || location,
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
async function fetchIndeedRSS(keywords: string[], location: string): Promise<RawJob[]> {
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
        const title = content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/);
        const link = content.match(/<link>([\s\S]*?)<\/link>/);
        const desc = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/);
        const source = content.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/);

        const role = (title?.[1] || title?.[2] || "").replace(/<[^>]*>/g, "").trim();
        const url = (link?.[1] || "").trim();
        const description = (desc?.[1] || desc?.[2] || "").replace(/<[^>]*>/g, "").trim();
        const company = (source?.[1] || "Unknown").replace(/<[^>]*>/g, "").trim();

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
            workType: role.toLowerCase().includes("remote") ? "REMOTE" : "ONSITE",
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
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${search}&limit=20`, {
        signal: AbortSignal.timeout(10000),
      });
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
          description: (item.description || "").replace(/<[^>]*>/g, "").substring(0, 2000),
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

      const isRemote = item.remote === true || (item.tags || []).some((t: string) => t.toLowerCase().includes("remote"));

      jobs.push({
        company: item.company_name || "Unknown",
        role: item.title || "",
        url,
        platform: "OTHER",
        location: item.location || "EU / Remote",
        salary: null,
        description: (item.description || "").replace(/<[^>]*>/g, "").substring(0, 2000),
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
    const user = await prisma.user.findUnique({
      where: { email: "ali@demo.com" },
      include: { settings: true, resumes: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const keywords = user.settings?.searchKeywords?.split(",").map((k) => k.trim()) ?? [
      "MERN", "NestJS", "Next.js", "React", "Node.js",
    ];
    const location = user.settings?.searchLocation ?? "Lahore";

    // Fetch from all 4 sources in parallel
    const [jsearchJobs, indeedJobs, remotiveJobs, arbeitnowJobs] = await Promise.allSettled([
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

    const sourceStats = {
      jsearch: jsearchJobs.status === "fulfilled" ? jsearchJobs.value.length : 0,
      indeed: indeedJobs.status === "fulfilled" ? indeedJobs.value.length : 0,
      remotive: remotiveJobs.status === "fulfilled" ? remotiveJobs.value.length : 0,
      arbeitnow: arbeitnowJobs.status === "fulfilled" ? arbeitnowJobs.value.length : 0,
    };

    console.log(`Scraped: JSearch=${sourceStats.jsearch}, Indeed=${sourceStats.indeed}, Remotive=${sourceStats.remotive}, Arbeitnow=${sourceStats.arbeitnow}`);

    // Deduplicate by URL
    const uniqueJobs = Array.from(new Map(allJobs.filter((j) => j.url).map((j) => [j.url, j])).values());

    // Check which URLs already exist in DB
    const existingUrls = new Set(
      (
        await prisma.job.findMany({
          where: { userId: user.id, url: { in: uniqueJobs.map((j) => j.url) } },
          select: { url: true },
        })
      ).map((j) => j.url)
    );

    const newJobs = uniqueJobs.filter((j) => !existingUrls.has(j.url));

    if (newJobs.length === 0) {
      return NextResponse.json({
        message: "No new jobs found",
        scraped: uniqueJobs.length,
        sources: sourceStats,
      });
    }

    // Save new jobs and send individual emails
    let savedCount = 0;
    let emailsSent = 0;

    for (const job of newJobs.slice(0, 30)) {
      const matchScore = calcMatchScore(job.role, job.description, keywords);
      const resumeName = recommendResume(job.role, job.description);
      const resume = user.resumes.find((r) => r.name === resumeName);

      const created = await prisma.job.create({
        data: {
          company: job.company,
          role: job.role,
          url: job.url,
          platform: job.platform,
          stage: "SAVED",
          applyType: job.applyType,
          isDirectApply: job.isDirectApply,
          applyOptions: job.applyOptions.length > 0 ? job.applyOptions : undefined,
          matchScore,
          description: job.description || null,
          salary: job.salary,
          location: job.location,
          workType: job.workType,
          resumeId: resume?.id ?? null,
          userId: user.id,
        },
      });

      await prisma.activity.create({
        data: {
          jobId: created.id,
          type: "job_created",
          toStage: "SAVED",
          note: `Auto-scraped from ${job.source}`,
          metadata: { automated: true, source: job.source, matchScore },
        },
      });

      savedCount++;

      // Send individual email per job
      if (user.settings?.emailNotifications !== false) {
        try {
          await sendJobEmail({
            company: job.company,
            role: job.role,
            url: job.url,
            platform: job.platform,
            location: job.location,
            salary: job.salary,
            description: job.description,
            applyType: job.applyType,
            isDirectApply: job.isDirectApply,
            matchScore,
            recommendedResume: resumeName,
            resumeFileUrl: resume?.fileUrl || null,
            source: job.source,
          });
          emailsSent++;
        } catch (emailErr) {
          console.error(`Failed to send email for ${job.role} at ${job.company}:`, emailErr);
        }
      }
    }

    return NextResponse.json({
      message: `Saved ${savedCount} new jobs, sent ${emailsSent} emails`,
      scraped: uniqueJobs.length,
      saved: savedCount,
      emailsSent,
      sources: sourceStats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Scrape cron error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
