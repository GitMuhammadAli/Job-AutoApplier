import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobEmail, sendFollowUpReminder, sendGhostAlert, sendWeeklyDigest } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─────────── Scraper helpers (imported inline to keep single file) ───────────

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

interface UserProfile {
  skills: string[];
  keywords: string[];
  experienceLevel: string | null;
  jobCategories: string[];
  preferredWorkType: string | null;
  minSalary: number | null;
  maxSalary: number | null;
}

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

function extractSkillsFromContent(content: string): string[] {
  return content.toLowerCase().split(/[,\n;|]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40);
}

function smartRecommendResume(title: string, desc: string, resumes: ResumeWithContent[]): { name: string; id: string | null; matchedSkills: string[] } {
  const jobText = (title + " " + desc).toLowerCase();
  let best = { name: "General", id: null as string | null, matchedSkills: [] as string[] };
  let bestScore = 0;
  for (const resume of resumes) {
    if (!resume.content) continue;
    const skills = extractSkillsFromContent(resume.content);
    const matched = skills.filter((s) => jobText.includes(s));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      best = { name: resume.name, id: resume.id, matchedSkills: matched.slice(0, 8) };
    }
  }
  if (bestScore === 0) {
    const fallback: Record<string, string[]> = {
      "Full-Stack": ["full stack", "fullstack", "mern"],
      Backend: ["backend", "node", "nestjs", "express", "api"],
      Frontend: ["frontend", "react", "vue", "angular"],
      DevOps: ["devops", "docker", "kubernetes"],
    };
    for (const resume of resumes) {
      const kws = fallback[resume.name] || [];
      const score = kws.filter((kw) => jobText.includes(kw)).length;
      if (score > bestScore) { bestScore = score; best = { name: resume.name, id: resume.id, matchedSkills: [] }; }
    }
  }
  return best;
}

function smartMatchScore(title: string, desc: string, profile: UserProfile): number {
  const jobText = (title + " " + desc).toLowerCase();
  let score = 0, maxP = 0;
  if (profile.skills.length > 0) { const m = profile.skills.filter((s) => jobText.includes(s.toLowerCase())); score += m.length * 3; maxP += profile.skills.length * 3; }
  if (profile.keywords.length > 0) { const m = profile.keywords.filter((kw) => jobText.includes(kw.toLowerCase())); score += m.length * 2; maxP += profile.keywords.length * 2; }
  if (profile.jobCategories.length > 0) { if (profile.jobCategories.some((cat) => (CATEGORY_KEYWORDS[cat] || []).some((kw) => jobText.includes(kw)))) score += 10; maxP += 10; }
  if (profile.experienceLevel && profile.experienceLevel !== "ANY") { const e = EXP_FILTERS[profile.experienceLevel]; if (e && e.boost.some((r) => r.test(title + " " + desc))) score += 5; maxP += 5; }
  return maxP === 0 ? 0 : Math.min(Math.round((score / maxP) * 100), 100);
}

function shouldFilterOut(job: { role: string; description: string; workType: string }, profile: UserProfile): boolean {
  const text = job.role + " " + job.description;
  if (profile.experienceLevel && profile.experienceLevel !== "ANY") {
    const e = EXP_FILTERS[profile.experienceLevel];
    if (e && e.skip.some((r) => r.test(text))) return true;
  }
  if (profile.preferredWorkType) {
    if (profile.preferredWorkType === "REMOTE" && job.workType === "ONSITE") return true;
    if (profile.preferredWorkType === "ONSITE" && job.workType === "REMOTE") return true;
  }
  return false;
}

// ── Source fetchers ──

async function fetchJSearch(keywords: string[], location: string): Promise<RawJob[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];
  const jobs: RawJob[] = [];
  for (const kw of keywords.slice(0, 3)) {
    try {
      const query = encodeURIComponent(`${kw} developer in ${location}`);
      const res = await fetch(`https://jsearch.p.rapidapi.com/search?query=${query}&num_pages=1&date_posted=today`, {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) continue;
      for (const item of data.data) {
        const isDirect = item.job_apply_is_direct === true;
        const applyLink = item.job_apply_link || "";
        const options: Array<{ link: string; source: string }> = [];
        if (applyLink) options.push({ link: applyLink, source: "direct" });
        if (Array.isArray(item.apply_options)) for (const opt of item.apply_options) { if (opt.apply_link && opt.publisher) options.push({ link: opt.apply_link, source: opt.publisher }); }
        let applyType: RawJob["applyType"] = "REGULAR";
        if (isDirect) applyType = "EASY_APPLY";
        else if (options.some((o) => o.source.toLowerCase().includes("linkedin"))) applyType = "QUICK_APPLY";
        const isRemote = item.job_is_remote === true || (item.job_title || "").toLowerCase().includes("remote") || (item.job_city || "").toLowerCase() === "remote";
        jobs.push({
          company: item.employer_name || "Unknown", role: item.job_title || "", url: applyLink || item.job_google_link || "",
          platform: "LINKEDIN", location: [item.job_city, item.job_state, item.job_country].filter(Boolean).join(", ") || location,
          salary: item.job_min_salary && item.job_max_salary ? `${item.job_salary_currency || "$"}${item.job_min_salary}-${item.job_max_salary}/${item.job_salary_period || "year"}` : null,
          description: (item.job_description || "").substring(0, 2000), applyType, isDirectApply: isDirect, applyOptions: options,
          workType: isRemote ? "REMOTE" : "ONSITE", source: "jsearch",
        });
      }
    } catch (err) { console.error(`JSearch error for "${kw}":`, err); }
  }
  return jobs;
}

async function fetchIndeedRSS(keywords: string[], location: string): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  for (const kw of keywords.slice(0, 5)) {
    try {
      const q = encodeURIComponent(kw.toLowerCase() + " developer");
      const l = encodeURIComponent(location);
      const res = await fetch(`https://pk.indeed.com/rss?q=${q}&l=${l}&sort=date`, { headers: { "User-Agent": "Mozilla/5.0 (JobPilot RSS Reader)" }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const c = match[1];
        const title = c.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/);
        const link = c.match(/<link>([\s\S]*?)<\/link>/);
        const desc = c.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/);
        const source = c.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/);
        const role = (title?.[1] || title?.[2] || "").replace(/<[^>]*>/g, "").trim();
        const url = (link?.[1] || "").trim();
        const description = (desc?.[1] || desc?.[2] || "").replace(/<[^>]*>/g, "").trim();
        const company = (source?.[1] || "Unknown").replace(/<[^>]*>/g, "").trim();
        if (role && url) jobs.push({ company, role, url, platform: "INDEED", location, salary: null, description: description.substring(0, 2000), applyType: "UNKNOWN", isDirectApply: false, applyOptions: [{ link: url, source: "indeed" }], workType: role.toLowerCase().includes("remote") ? "REMOTE" : "ONSITE", source: "indeed_rss" });
      }
    } catch { /* skip */ }
  }
  return jobs;
}

async function fetchRemotive(keywords: string[]): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  for (const kw of keywords.slice(0, 2)) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw.toLowerCase())}&limit=20`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) continue;
      for (const item of data.jobs) {
        const url = item.url || ""; if (!url) continue;
        jobs.push({ company: item.company_name || "Unknown", role: item.title || "", url, platform: "OTHER", location: item.candidate_required_location || "Remote", salary: item.salary || null, description: (item.description || "").replace(/<[^>]*>/g, "").substring(0, 2000), applyType: "REGULAR", isDirectApply: false, applyOptions: [{ link: url, source: "remotive" }], workType: "REMOTE", source: "remotive" });
      }
    } catch (err) { console.error(`Remotive error:`, err); }
  }
  return jobs;
}

async function fetchArbeitnow(): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];
    for (const item of data.data.slice(0, 30)) {
      const url = item.url || ""; if (!url) continue;
      const isRemote = item.remote === true || (item.tags || []).some((t: string) => t.toLowerCase().includes("remote"));
      jobs.push({ company: item.company_name || "Unknown", role: item.title || "", url, platform: "OTHER", location: item.location || "EU / Remote", salary: null, description: (item.description || "").replace(/<[^>]*>/g, "").substring(0, 2000), applyType: "REGULAR", isDirectApply: false, applyOptions: [{ link: url, source: "arbeitnow" }], workType: isRemote ? "REMOTE" : "ONSITE", source: "arbeitnow" });
    }
  } catch (err) { console.error("Arbeitnow error:", err); }
  return jobs;
}

// ─────────── Main unified cron handler ───────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    const users = await prisma.user.findMany({
      where: { settings: { isNot: null } },
      include: { settings: true, resumes: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ message: "No users with settings found", results });
    }

    const perUser: Record<string, Record<string, unknown>> = {};

    for (const user of users) {
      const userResults: Record<string, unknown> = {};
      const settings = user.settings;
      const emailEnabled = settings?.emailNotifications !== false;

      // ── 1. Job Scraping ──
      try {
        const keywords = settings?.searchKeywords?.split(",").map((k) => k.trim()).filter(Boolean) ?? [];
        if (keywords.length === 0) {
          userResults.scraper = { skipped: "No search keywords configured" };
        } else {
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

          const uniqueJobs = Array.from(new Map(allJobs.filter((j) => j.url).map((j) => [j.url, j])).values());
          const existingUrls = new Set(
            (await prisma.job.findMany({ where: { userId: user.id, url: { in: uniqueJobs.map((j) => j.url) } }, select: { url: true } })).map((j) => j.url),
          );
          const newJobs = uniqueJobs.filter((j) => !existingUrls.has(j.url));
          const filteredJobs = newJobs.filter((job) => !shouldFilterOut({ role: job.role, description: job.description, workType: job.workType }, profile));

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
            if (emailEnabled && user.email) {
              try {
                await sendJobEmail({
                  company: job.company, role: job.role, url: job.url, platform: job.platform,
                  location: job.location, salary: job.salary, description: job.description,
                  applyType: job.applyType, isDirectApply: job.isDirectApply, matchScore,
                  recommendedResume: recommended.name, resumeFileUrl: resume?.fileUrl || null,
                  matchedSkills: recommended.matchedSkills, source: job.source,
                }, user.email);
                emailsSent++;
              } catch (e) { console.error(`Email failed for ${job.role}:`, e); }
            }
          }
          userResults.scraper = { scraped: uniqueJobs.length, saved: savedCount, filtered: newJobs.length - filteredJobs.length, emailsSent };
        }
      } catch (err) { userResults.scraper = { error: err instanceof Error ? err.message : "Unknown" }; }

      // ── 2. Follow-up Reminders ──
      try {
        const followUpDays = settings?.followUpDays ?? 7;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - followUpDays);
        const staleJobs = await prisma.job.findMany({ where: { userId: user.id, stage: "APPLIED", appliedDate: { lte: cutoff } } });
        if (staleJobs.length > 0 && emailEnabled && user.email) {
          const data = staleJobs.map((j) => ({ company: j.company, role: j.role, daysAgo: Math.floor((Date.now() - (j.appliedDate?.getTime() ?? Date.now())) / 86400000), url: j.url }));
          await sendFollowUpReminder(data, user.email);
        }
        userResults.followUp = { count: staleJobs.length };
      } catch (err) { userResults.followUp = { error: err instanceof Error ? err.message : "Unknown" }; }

      // ── 3. Ghost Detection ──
      try {
        const ghostDays = settings?.ghostDays ?? 14;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - ghostDays);
        const ghosted = await prisma.job.findMany({ where: { userId: user.id, stage: "APPLIED", appliedDate: { lte: cutoff }, isGhosted: false } });
        for (const job of ghosted) {
          await prisma.$transaction([
            prisma.job.update({ where: { id: job.id }, data: { stage: "GHOSTED", isGhosted: true } }),
            prisma.activity.create({ data: { jobId: job.id, type: "ghost_detected", fromStage: "APPLIED", toStage: "GHOSTED", note: `Auto-marked ghosted after ${ghostDays}d`, metadata: { automated: true } } }),
          ]);
        }
        if (ghosted.length > 0 && emailEnabled && user.email) {
          await sendGhostAlert(ghosted.map((j) => ({ company: j.company, role: j.role, daysAgo: Math.floor((Date.now() - (j.appliedDate?.getTime() ?? Date.now())) / 86400000) })), user.email);
        }
        userResults.ghost = { count: ghosted.length };
      } catch (err) { userResults.ghost = { error: err instanceof Error ? err.message : "Unknown" }; }

      // ── 4. Weekly Digest (only on Sundays) ──
      const today = new Date();
      if (today.getDay() === 0) {
        try {
          const jobs = await prisma.job.findMany({ where: { userId: user.id } });
          const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
          const appliedThisWeek = jobs.filter((j) => j.appliedDate && j.appliedDate >= weekAgo).length;
          const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
          const offers = jobs.filter((j) => j.stage === "OFFER").length;
          const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
          const applied = jobs.filter((j) => j.stage !== "SAVED").length;
          const responseRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;
          if (emailEnabled && user.email) await sendWeeklyDigest({ totalJobs: jobs.length, appliedThisWeek, interviews, offers, ghosted, responseRate }, user.email);
          userResults.digest = { sent: true };
        } catch (err) { userResults.digest = { error: err instanceof Error ? err.message : "Unknown" }; }
      } else {
        userResults.digest = { skipped: "Not Sunday" };
      }

      perUser[user.email || user.id] = userResults;
    }

    results.users = perUser;
    results.totalUsers = users.length;

    return NextResponse.json({ message: "Daily cron completed", results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Daily cron error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
