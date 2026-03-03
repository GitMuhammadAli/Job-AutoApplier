/**
 * Query-time recommendation engine for job display.
 * Loads GlobalJobs, applies hard filters, scores, deduplicates, paginates.
 * Uses the SAME computeMatchScore as auto-apply cron.
 */

import { prisma } from "@/lib/prisma";
import {
  computeMatchScore,
  normalizeText,
  keywordMatchesText,
  locationPassesFilter,
  keywordsMatchJob,
  normalizeForDedup,
  isRemoteLocation,
  expandStackAcronyms,
  type GlobalJobLike,
  type UserSettingsLike,
  type MatchResult,
} from "./score-engine";

// ── Types ──

export interface RecommendedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  category: string | null;
  skills: string[];
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  companyEmail: string | null;
  emailConfidence: number | null;
  postedDate: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  // Scoring
  matchScore: number;
  matchReasons: string[];
  bestResumeId: string | null;
  bestResumeName: string | null;
  keywordsMatched: string[];
  isRemote: boolean;
  // User interaction state
  userJobId: string | null;
  userJobStage: string | null;
  applicationStatus: string | null;
  isDismissed: boolean;
}

export interface RecommendationOptions {
  page?: number;
  pageSize?: number;
  sources?: string[];
  minScore?: number;
  maxDays?: number;
  sortBy?: "score" | "date";
  searchQuery?: string;
  locationFilter?: "all" | "city" | "country" | "remote";
  jobType?: string;
  hasEmail?: boolean;
  emailFilter?: "all" | "verified" | "none";
}

export interface RecommendationResult {
  jobs: RecommendedJob[];
  total: number;
  page: number;
  pageSize: number;
  timing: { sqlMs: number; filterMs: number; scoreMs: number; totalMs: number };
  sourceCounts: Record<string, number>;
  filterBreakdown: {
    sqlCandidates: number;
    afterLocation: number;
    afterKeywords: number;
    afterDedup: number;
    afterScoreFilter: number;
  };
}

// ── Main function ──

export async function getRecommendedJobs(
  userId: string,
  options: RecommendationOptions = {},
): Promise<RecommendationResult> {
  const totalStart = Date.now();
  const {
    page = 1,
    pageSize = 50,
    sources,
    minScore = 0,
    maxDays = 30,
    sortBy = "score",
    searchQuery,
    locationFilter,
    jobType,
    hasEmail,
    emailFilter,
  } = options;

  // ── STEP 1: Load user profile (parallel queries) ──

  const [settings, resumes, userJobData] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId },
      select: {
        keywords: true,
        negativeKeywords: true,
        city: true,
        country: true,
        experienceLevel: true,
        workType: true,
        jobType: true,
        preferredCategories: true,
        preferredPlatforms: true,
        salaryMin: true,
        salaryMax: true,
        blacklistedCompanies: true,
      },
    }),
    prisma.resume.findMany({
      where: { userId, isDeleted: false },
      select: {
        id: true,
        name: true,
        content: true,
        detectedSkills: true,
      },
    }),
    prisma.userJob.findMany({
      where: { userId },
      select: {
        id: true,
        globalJobId: true,
        stage: true,
        isDismissed: true,
        application: { select: { status: true } },
      },
    }).then((jobs) => {
      const excluded = new Set<string>();
      const map = new Map<string, { userJobId: string; stage: string; applicationStatus: string | null; isDismissed: boolean }>();
      const ACTED_STAGES = new Set(["APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"]);
      for (const j of jobs) {
        map.set(j.globalJobId, {
          userJobId: j.id,
          stage: j.stage,
          applicationStatus: j.application?.status ?? null,
          isDismissed: j.isDismissed,
        });
        if (j.isDismissed || ACTED_STAGES.has(j.stage) || j.application?.status) {
          excluded.add(j.globalJobId);
        }
      }
      return { excluded, map };
    }),
  ]);

  if (!settings || (settings.keywords ?? []).length === 0) {
    return emptyResult(page, pageSize, "Add keywords in Settings to get recommendations.");
  }

  const userKeywords = (settings.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const userCity = settings.city;
  const userCountry = settings.country;
  const blacklist = (settings.blacklistedCompanies ?? []).map((c) => c.toLowerCase().trim()).filter(Boolean);
  const enabledPlatforms = (settings.preferredPlatforms ?? []).map((p) => p.toLowerCase().trim()).filter(Boolean);

  // Determine which sources to filter by
  const sourcesFilter = sources ?? (enabledPlatforms.length > 0 ? enabledPlatforms : undefined);

  // ── STEP 2: SQL rough filter ──

  const sqlStart = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);

  const { excluded: excludedJobIds, map: userJobMap } = userJobData;
  const excludedIds = Array.from(excludedJobIds);

  // Stage 1: Light query — load candidates WITHOUT description (~100KB vs ~10MB)
  const candidatesLight = await prisma.globalJob.findMany({
    where: {
      isActive: true,
      createdAt: { gte: cutoffDate },
      ...(sourcesFilter ? { source: { in: sourcesFilter } } : {}),
      ...(excludedIds.length > 0 ? { id: { notIn: excludedIds.slice(0, 1000) } } : {}),
    },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      salary: true,
      jobType: true,
      experienceLevel: true,
      category: true,
      skills: true,
      source: true,
      sourceId: true,
      sourceUrl: true,
      applyUrl: true,
      companyEmail: true,
      emailConfidence: true,
      postedDate: true,
      firstSeenAt: true,
      lastSeenAt: true,
      createdAt: true,
      isFresh: true,
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const sqlMs = Date.now() - sqlStart;

  // Augmented candidate type: description loaded lazily in Stage 2
  type Candidate = (typeof candidatesLight)[0] & { description: string | null };
  const candidates: Candidate[] = candidatesLight.map((c) => ({ ...c, description: null }));

  // ── STEP 3 & 4: Hard filters (JS) ──

  const filterStart = Date.now();
  const afterLocation: Candidate[] = [];

  for (const job of candidates) {
    // Blacklist filter
    if (blacklist.length > 0) {
      const co = (job.company ?? "").toLowerCase().trim();
      if (blacklist.some((bl) => co.includes(bl) || bl.includes(co))) continue;
    }

    // Location hard filter
    if (locationFilter === "all") {
      // User explicitly wants all locations
    } else if (locationFilter === "remote") {
      const loc = normalizeText(job.location || "");
      if (!isRemoteLocation(loc)) continue;
    } else if (locationFilter === "city") {
      if (!locationPassesFilter(job.location, userCity, null)) continue;
    } else if (locationFilter === "country") {
      if (!locationPassesFilter(job.location, null, userCountry)) continue;
    } else {
      if (!locationPassesFilter(job.location, userCity, userCountry)) continue;
    }

    afterLocation.push(job);
  }

  // Negative keyword hard filter — check title+skills first (no description needed)
  const negKeywords = (settings.negativeKeywords ?? []).map((k: string) => k.toLowerCase().trim()).filter(Boolean);
  const afterNegFilter: Candidate[] = [];
  if (negKeywords.length > 0) {
    for (const job of afterLocation) {
      const titleLower = normalizeText(job.title);
      const skillsLower = (job.skills ?? []).map((s: string) => normalizeText(s)).join(" ");
      const negMatch = negKeywords.some(
        (nk: string) => keywordMatchesText(nk, titleLower) || keywordMatchesText(nk, skillsLower)
      );
      if (!negMatch) afterNegFilter.push(job);
    }
  } else {
    afterNegFilter.push(...afterLocation);
  }

  // Keyword matching — first pass with title+skills only
  const afterKeywords: Array<{ job: Candidate; matchedKw: string[] }> = [];
  const needDescription: Candidate[] = []; // jobs that didn't match on title+skills alone

  for (const job of afterNegFilter) {
    const titleLower = normalizeText(job.title);
    const skillsLower = (job.skills ?? []).map((s: string) => normalizeText(s)).join(" ");

    // Expand stack acronyms (e.g. "MERN" in title → also matches react, node, etc.)
    const stackExtra = expandStackAcronyms(`${titleLower} ${skillsLower}`);
    const expandedSkills = stackExtra.length > 0 ? `${skillsLower} ${stackExtra.join(" ")}` : skillsLower;

    // Try matching with title+skills only (no description)
    const matchedKw = keywordsMatchJob(userKeywords, titleLower, "", expandedSkills);

    if (matchedKw.length > 0) {
      afterKeywords.push({ job, matchedKw });
      continue;
    }

    // Search query override — try with title+skills first
    if (searchQuery) {
      const searchLower = normalizeText(searchQuery);
      const combined = `${titleLower} ${skillsLower} ${normalizeText(job.company)}`;
      if (keywordMatchesText(searchLower, combined) || combined.includes(searchLower)) {
        afterKeywords.push({ job, matchedKw: [searchQuery] });
        continue;
      }
    }

    // No match on title+skills — this job needs description to determine
    needDescription.push(job);
  }

  // Stage 2: Load descriptions ONLY for borderline jobs that didn't match on title+skills
  if (needDescription.length > 0) {
    const descriptionIds = needDescription.map((j) => j.id);
    const descriptions = await prisma.globalJob.findMany({
      where: { id: { in: descriptionIds } },
      select: { id: true, description: true },
    });
    const descMap = new Map(descriptions.map((d) => [d.id, d.description]));

    // Merge descriptions back into candidates
    for (const job of needDescription) {
      job.description = descMap.get(job.id) ?? null;
    }

    // Re-check negative keywords with description for borderline jobs
    const afterDescNegFilter: Candidate[] = [];
    if (negKeywords.length > 0) {
      for (const job of needDescription) {
        const titleLower = normalizeText(job.title);
        const descLower = normalizeText(job.description || "");
        const skillsLower = (job.skills ?? []).map((s: string) => normalizeText(s)).join(" ");
        const negMatch = negKeywords.some(
          (nk: string) => keywordMatchesText(nk, titleLower) || keywordMatchesText(nk, descLower) || keywordMatchesText(nk, skillsLower)
        );
        if (!negMatch) afterDescNegFilter.push(job);
      }
    } else {
      afterDescNegFilter.push(...needDescription);
    }

    // Now match with full description
    for (const job of afterDescNegFilter) {
      const titleLower = normalizeText(job.title);
      const descLower = normalizeText(job.description || "");
      const skillsLower = (job.skills ?? []).map((s: string) => normalizeText(s)).join(" ");

      const matchedKw = keywordsMatchJob(userKeywords, titleLower, descLower, skillsLower);

      if (matchedKw.length > 0) {
        afterKeywords.push({ job, matchedKw });
        continue;
      }

      // Search query override with description
      if (searchQuery) {
        const searchLower = normalizeText(searchQuery);
        const combined = `${titleLower} ${descLower} ${skillsLower} ${normalizeText(job.company)}`;
        if (keywordMatchesText(searchLower, combined) || combined.includes(searchLower)) {
          afterKeywords.push({ job, matchedKw: [searchQuery] });
        }
      }
    }
  }
  const filterMs = Date.now() - filterStart;

  // ── STEP 5: Score surviving jobs ──

  const scoreStart = Date.now();
  const userProfile: UserSettingsLike = {
    keywords: settings.keywords ?? [],
    negativeKeywords: settings.negativeKeywords ?? [],
    city: settings.city,
    country: settings.country,
    experienceLevel: settings.experienceLevel,
    workType: settings.workType ?? [],
    jobType: settings.jobType ?? [],
    preferredCategories: settings.preferredCategories ?? [],
    preferredPlatforms: settings.preferredPlatforms ?? [],
    salaryMin: settings.salaryMin,
    salaryMax: settings.salaryMax,
    blacklistedCompanies: settings.blacklistedCompanies ?? [],
  };

  const resumeInputs = resumes.map((r) => ({
    id: r.id,
    name: r.name,
    content: r.content,
    detectedSkills: r.detectedSkills,
  }));

  type ScoredJob = {
    job: Candidate;
    result: MatchResult;
    matchedKw: string[];
  };

  const scored: ScoredJob[] = [];
  for (const { job, matchedKw } of afterKeywords) {
    const jobInput: GlobalJobLike = {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      salary: job.salary,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      category: job.category,
      skills: job.skills ?? [],
      source: job.source,
      isFresh: job.isFresh,
      firstSeenAt: job.firstSeenAt,
    };

    const result = computeMatchScore(jobInput, userProfile, resumeInputs);
    if (result.score <= 0) continue;
    scored.push({ job, result, matchedKw });
  }
  const scoreMs = Date.now() - scoreStart;

  // Apply optional filters
  let filtered = scored;
  if (minScore > 0) {
    filtered = filtered.filter((s) => s.result.score >= minScore);
  }
  if (jobType) {
    filtered = filtered.filter((s) => {
      const jt = (s.job.jobType ?? "").toLowerCase();
      return jt.includes(jobType.toLowerCase());
    });
  }
  if (hasEmail) {
    filtered = filtered.filter((s) => !!s.job.companyEmail);
  }
  if (emailFilter === "verified") {
    filtered = filtered.filter((s) => s.job.companyEmail && (s.job.emailConfidence ?? 0) >= 80);
  } else if (emailFilter === "none") {
    filtered = filtered.filter((s) => !s.job.companyEmail);
  }

  // ── STEP 6: Cross-source deduplication ──

  const dedupMap = new Map<string, ScoredJob>();
  for (const s of filtered) {
    const key = `${normalizeForDedup(s.job.title)}|${normalizeForDedup(s.job.company)}`;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, s);
      continue;
    }
    // Keep higher score; if tied, keep the one with description
    if (s.result.score > existing.result.score) {
      dedupMap.set(key, s);
    } else if (s.result.score === existing.result.score && s.job.description && !existing.job.description) {
      dedupMap.set(key, s);
    }
  }
  const deduped = Array.from(dedupMap.values());

  // ── STEP 7: Sort ──

  if (sortBy === "date") {
    deduped.sort((a, b) => {
      const ta = new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime();
      if (ta !== 0) return ta;
      return b.result.score - a.result.score;
    });
  } else {
    deduped.sort((a, b) => {
      const sd = b.result.score - a.result.score;
      if (sd !== 0) return sd;
      return new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime();
    });
  }

  // Source counts before pagination
  const sourceCounts: Record<string, number> = {};
  for (const s of deduped) {
    sourceCounts[s.job.source] = (sourceCounts[s.job.source] || 0) + 1;
  }

  // ── STEP 8: Paginate ──

  const total = deduped.length;
  const start = (page - 1) * pageSize;
  const sliced = deduped.slice(start, start + pageSize);

  // ── STEP 9: Build response (strip description) ──

  const jobs: RecommendedJob[] = sliced.map((s) => {
    const interaction = userJobMap.get(s.job.id);
    const loc = normalizeText(s.job.location || "");
    return {
      id: s.job.id,
      title: s.job.title,
      company: s.job.company,
      location: s.job.location,
      salary: s.job.salary,
      jobType: s.job.jobType,
      experienceLevel: s.job.experienceLevel,
      category: s.job.category,
      skills: s.job.skills ?? [],
      source: s.job.source,
      sourceId: s.job.sourceId,
      sourceUrl: s.job.sourceUrl,
      applyUrl: s.job.applyUrl,
      companyEmail: s.job.companyEmail,
      emailConfidence: s.job.emailConfidence ?? null,
      postedDate: s.job.postedDate?.toISOString() ?? null,
      firstSeenAt: s.job.firstSeenAt.toISOString(),
      lastSeenAt: s.job.lastSeenAt.toISOString(),
      createdAt: s.job.createdAt.toISOString(),
      matchScore: s.result.score,
      matchReasons: s.result.reasons,
      bestResumeId: s.result.bestResumeId,
      bestResumeName: s.result.bestResumeName,
      keywordsMatched: s.matchedKw,
      isRemote: isRemoteLocation(loc),
      userJobId: interaction?.userJobId ?? null,
      userJobStage: interaction?.stage ?? null,
      applicationStatus: interaction?.applicationStatus ?? null,
      isDismissed: interaction?.isDismissed ?? false,
    };
  });

  return {
    jobs,
    total,
    page,
    pageSize,
    timing: {
      sqlMs,
      filterMs,
      scoreMs,
      totalMs: Date.now() - totalStart,
    },
    sourceCounts,
    filterBreakdown: {
      sqlCandidates: candidatesLight.length,
      afterLocation: afterLocation.length,
      afterKeywords: afterKeywords.length,
      afterDedup: deduped.length,
      afterScoreFilter: filtered.length,
    },
  };
}

function emptyResult(page: number, pageSize: number, _reason: string): RecommendationResult {
  return {
    jobs: [],
    total: 0,
    page,
    pageSize,
    timing: { sqlMs: 0, filterMs: 0, scoreMs: 0, totalMs: 0 },
    sourceCounts: {},
    filterBreakdown: { sqlCandidates: 0, afterLocation: 0, afterKeywords: 0, afterDedup: 0, afterScoreFilter: 0 },
  };
}
