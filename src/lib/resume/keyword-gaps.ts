/**
 * Cross-JD keyword gap analysis.
 *
 * The strategic view that the per-JD coverage panel can't give you. Looks
 * at the last N jobs in the user's shortlist (saved + recommended), counts
 * how often each missing keyword shows up across all of them, and ranks
 * by impact. Lets the user invest in learning the ONE keyword that
 * unlocks the most jobs instead of chasing whatever the current JD wants.
 *
 * Pure aggregation over `extractJdKeywords` + `findAdjacencies`. No LLM,
 * no extra DB writes — runs on each page load against the existing
 * GlobalJob + UserSettings + ResumeProfile data.
 */

import type { ResumeProfile } from "./types";
import { extractJdKeywords, computeAtsCoverageLite } from "./keyword-coverage";
import { findAdjacenciesForKeyword } from "./keyword-adjacency";

export interface KeywordGapEntry {
  /** Lowercase canonical form of the JD keyword. */
  keyword: string;
  /** How many of the analyzed JDs mentioned this keyword. */
  jobCount: number;
  /** Percentage of analyzed JDs that mentioned it. */
  jobFraction: number;
  /**
   * Skills in the user's profile that signal experience adjacent to this
   * keyword. Empty when the keyword is "cold" — no related experience.
   */
  adjacentSkills: string[];
  /** Project ids whose content carries adjacent tech. */
  adjacentProjectIds: string[];
  /** True if any adjacency surfaced — UI uses this for a "you have related" badge. */
  hasAdjacency: boolean;
  /**
   * Sample of titles+companies for the jobs that asked for this keyword.
   * Helps the user understand "is this Senior FE roles asking, or DevOps?"
   * before they invest in learning. Capped at 5.
   */
  sampleJobs: Array<{ title: string; company: string }>;
}

export interface KeywordGapAnalysis {
  /** Total number of jobs analyzed. */
  jobCount: number;
  /** Missing-keyword entries ranked by jobCount desc. */
  entries: KeywordGapEntry[];
  /** Stats summary surfaced above the table. */
  summary: {
    /** Distinct missing keywords across all JDs. */
    distinctMissing: number;
    /** Average ATS coverage across the analyzed jobs. */
    avgCoverage: number;
    /** Top-1 keyword's impact: "Adding X unlocks N jobs". */
    topImpact: { keyword: string; jobs: number; adjacent: boolean } | null;
  };
}

export interface JobLike {
  id: string;
  title: string;
  company: string;
  description: string | null;
  skills: string[];
}

/**
 * Run gap analysis over the supplied jobs.
 *
 * @param jobs   Job rows to analyze. Caller decides scope: recommended,
 *               saved, applied — anything with a JD-like description.
 * @param profile  User's structured profile (used for adjacency lookup).
 * @param userKnownHaystack  Concatenated lowercase string of all places
 *               the user might have a keyword (settings + resume content
 *               + detected skills). Used by computeAtsCoverageLite per-job
 *               to determine missing keywords.
 * @param userKnownSkills  Flat lowercase skill set for fast membership.
 * @param options.maxKeywords  Per-JD keyword extraction cap (default 25,
 *               same as computeKeywordCoverage).
 * @param options.topN  Truncate the final ranked list to this many
 *               entries (default 30 — UI can paginate).
 */
export function analyzeKeywordGaps(
  jobs: JobLike[],
  profile: ResumeProfile,
  userKnownHaystack: string,
  userKnownSkills: string[],
  options: { maxKeywords?: number; topN?: number } = {},
): KeywordGapAnalysis {
  const { maxKeywords = 25, topN = 30 } = options;
  if (jobs.length === 0) {
    return {
      jobCount: 0,
      entries: [],
      summary: { distinctMissing: 0, avgCoverage: 1, topImpact: null },
    };
  }

  // Per-keyword aggregator: counts + sample job collector.
  const keywordCount = new Map<string, number>();
  const keywordSamples = new Map<string, Array<{ title: string; company: string }>>();
  let coverageSum = 0;
  let coverageJobs = 0;

  for (const job of jobs) {
    const jdText = [job.title, ...(job.skills ?? []), job.description ?? ""]
      .filter(Boolean)
      .join(" \n ");
    if (!jdText.trim()) continue;

    const coverage = computeAtsCoverageLite(jdText, userKnownHaystack, userKnownSkills);
    if (coverage.total > 0) {
      coverageSum += coverage.ratio;
      coverageJobs++;
    }
    for (const kw of coverage.missing) {
      const k = kw.toLowerCase();
      keywordCount.set(k, (keywordCount.get(k) ?? 0) + 1);
      const samples = keywordSamples.get(k) ?? [];
      if (samples.length < 5) {
        samples.push({ title: job.title, company: job.company });
      }
      keywordSamples.set(k, samples);
    }
  }

  // Build entries with adjacency.
  const entries: KeywordGapEntry[] = [];
  keywordCount.forEach((count, kw) => {
    const adj = findAdjacenciesForKeyword(kw, profile);
    entries.push({
      keyword: kw,
      jobCount: count,
      jobFraction: count / jobs.length,
      adjacentSkills: adj.adjacentSkills,
      adjacentProjectIds: adj.adjacentProjectIds,
      hasAdjacency: adj.adjacentSkills.length > 0 || adj.adjacentProjectIds.length > 0,
      sampleJobs: keywordSamples.get(kw) ?? [],
    });
  });

  // Rank: jobCount desc, hasAdjacency true first as tiebreaker (you can act
  // on adjacency now; cold keywords need actual learning).
  entries.sort((a, b) => {
    if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount;
    if (a.hasAdjacency !== b.hasAdjacency) return a.hasAdjacency ? -1 : 1;
    return a.keyword.localeCompare(b.keyword);
  });

  const top = entries[0];
  const topImpact = top
    ? { keyword: top.keyword, jobs: top.jobCount, adjacent: top.hasAdjacency }
    : null;

  return {
    jobCount: jobs.length,
    entries: entries.slice(0, topN),
    summary: {
      distinctMissing: entries.length,
      avgCoverage: coverageJobs === 0 ? 1 : coverageSum / coverageJobs,
      topImpact,
    },
  };
}

// Re-export for the route that calls this — keeps the consumer's imports tight.
export { extractJdKeywords };
