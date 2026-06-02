/**
 * Outcome analytics — "what's working for you" across the resumes you've
 * sent. Derives outcomes from existing data (UserJob.stage + JobApplication
 * + ResumeGeneration) without any schema changes. Pure aggregation.
 *
 * Outcome signal hierarchy (most informative first):
 *   OFFER     — winning resume signal, count heavily
 *   INTERVIEW — strong positive
 *   APPLIED   — neutral (we sent, no response yet)
 *   GHOSTED   — soft negative (could be the company, not the resume)
 *   REJECTED  — hard negative
 *
 * This lets the user see things like:
 *   - "T03 at ≥80% ATS coverage: 3/5 callbacks (60%). T08 at <60%: 0/12 (0%)."
 *   - "Force-included keywords correlate with +X% callback rate."
 *
 * The numbers help convert guessing into knowing.
 */

import type { JobStage } from "@prisma/client";

/**
 * Outcome classification — derived from JobStage. INTERVIEW and OFFER count
 * as positive (callback achieved). REJECTED/GHOSTED count as negative.
 * APPLIED is in-flight. SAVED never sent → not counted.
 */
export type Outcome = "positive" | "negative" | "in-flight" | "not-sent";

export function classifyOutcome(stage: JobStage): Outcome {
  switch (stage) {
    case "OFFER":
    case "INTERVIEW":
      return "positive";
    case "REJECTED":
    case "GHOSTED":
      return "negative";
    case "APPLIED":
      return "in-flight";
    case "SAVED":
    default:
      return "not-sent";
  }
}

export interface ApplicationOutcomeRow {
  applicationId: string;
  userJobId: string;
  stage: JobStage;
  outcome: Outcome;
  templateId: string | null;
  /**
   * Pre-tailoring ATS keyword coverage at the time of generation, if known.
   * Pulled from ResumeGeneration.matchedKeywords for now (we know how many
   * landed, not how many were missing). UI presents this as "covered count".
   */
  matchedKeywordCount: number | null;
  /** When the user actually sent the application. */
  sentAt: Date | null;
}

export interface TemplateBreakdown {
  templateId: string;
  sent: number;
  positive: number;
  negative: number;
  inFlight: number;
  /** positive / (positive + negative). Null when no decisive outcomes yet. */
  callbackRate: number | null;
}

export interface CoverageBucketBreakdown {
  /** "≥80%" | "60-79%" | "<60%" | "unknown" */
  bucket: string;
  sent: number;
  positive: number;
  negative: number;
  inFlight: number;
  callbackRate: number | null;
}

export interface OutcomeAnalysis {
  /** Total applications counted (status = SENT). */
  totalSent: number;
  /** Outcome rollup. */
  outcomes: { positive: number; negative: number; inFlight: number };
  /** Per-template breakdown sorted by `sent desc` (active templates first). */
  byTemplate: TemplateBreakdown[];
  /** Per-coverage-bucket breakdown. */
  byCoverage: CoverageBucketBreakdown[];
  /**
   * The single highest-conversion template, if there's enough signal
   * (≥ 3 sent applications + ≥1 positive). Null otherwise — we don't
   * pretend to know on small samples.
   */
  winningTemplate: TemplateBreakdown | null;
  /** Same idea for coverage buckets. */
  winningCoverageBucket: CoverageBucketBreakdown | null;
}

function bucketForCoverage(count: number | null, jdKeywordTotal: number | null): string {
  // Without a known JD-keyword total we can't compute a percentage. The
  // current schema stores matchedKeywords[] but not the total JD keyword
  // count at generation time — so we approximate buckets by raw matched
  // count. This is a placeholder UI signal; in a future migration we'd
  // store the ratio directly.
  if (count === null) return "unknown";
  if (count >= 8) return "≥8 keywords";
  if (count >= 5) return "5-7 keywords";
  if (count >= 1) return "1-4 keywords";
  return "0 keywords";
}

export function analyzeOutcomes(rows: ApplicationOutcomeRow[]): OutcomeAnalysis {
  const sentRows = rows.filter((r) => r.sentAt !== null);

  const outcomes = { positive: 0, negative: 0, inFlight: 0 };
  const byTemplateMap = new Map<string, TemplateBreakdown>();
  const byBucketMap = new Map<string, CoverageBucketBreakdown>();

  for (const r of sentRows) {
    if (r.outcome === "positive") outcomes.positive++;
    else if (r.outcome === "negative") outcomes.negative++;
    else if (r.outcome === "in-flight") outcomes.inFlight++;

    const tid = r.templateId ?? "(none)";
    const tBucket = byTemplateMap.get(tid) ?? {
      templateId: tid,
      sent: 0,
      positive: 0,
      negative: 0,
      inFlight: 0,
      callbackRate: null,
    };
    tBucket.sent++;
    if (r.outcome === "positive") tBucket.positive++;
    else if (r.outcome === "negative") tBucket.negative++;
    else if (r.outcome === "in-flight") tBucket.inFlight++;
    byTemplateMap.set(tid, tBucket);

    const cb = bucketForCoverage(r.matchedKeywordCount, null);
    const cBucket = byBucketMap.get(cb) ?? {
      bucket: cb,
      sent: 0,
      positive: 0,
      negative: 0,
      inFlight: 0,
      callbackRate: null,
    };
    cBucket.sent++;
    if (r.outcome === "positive") cBucket.positive++;
    else if (r.outcome === "negative") cBucket.negative++;
    else if (r.outcome === "in-flight") cBucket.inFlight++;
    byBucketMap.set(cb, cBucket);
  }

  // Compute callback rates.
  byTemplateMap.forEach((t) => {
    const decisive = t.positive + t.negative;
    t.callbackRate = decisive === 0 ? null : t.positive / decisive;
  });
  byBucketMap.forEach((c) => {
    const decisive = c.positive + c.negative;
    c.callbackRate = decisive === 0 ? null : c.positive / decisive;
  });

  const byTemplate = Array.from(byTemplateMap.values()).sort((a, b) => b.sent - a.sent);
  const byCoverage = Array.from(byBucketMap.values()).sort((a, b) => b.sent - a.sent);

  // Pick winners — only if we have enough signal. Otherwise we're just
  // promoting noise.
  const winningTemplate = pickWinner(byTemplate);
  const winningCoverageBucket = pickWinner(byCoverage);

  return {
    totalSent: sentRows.length,
    outcomes,
    byTemplate,
    byCoverage,
    winningTemplate,
    winningCoverageBucket,
  };
}

function pickWinner<T extends { sent: number; positive: number; callbackRate: number | null }>(
  rows: T[],
): T | null {
  const eligible = rows.filter((r) => r.sent >= 3 && r.positive >= 1 && r.callbackRate !== null);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => (b.callbackRate ?? 0) - (a.callbackRate ?? 0));
  return eligible[0];
}
