/**
 * Surface honest scraper failure reasons to the user.
 *
 * Was: every scraper silently returned [] on missing API keys / captcha /
 * selector breakage / rate limits. The user saw "0 jobs found" and couldn't
 * tell whether (a) genuinely no matches, (b) the scraper was broken,
 * (c) an upstream API key had expired. The dashboard is supposed to be
 * trustworthy — silent failures destroy trust.
 *
 * The data is already there: `scraper-runner.ts` writes every run to the
 * ScraperRun table with a status + errorMessage. This module reads that
 * table and turns it into a user-facing "why your job list is short"
 * summary that lives in the empty-state banner on /recommended.
 */

import { prisma } from "@/lib/prisma";

export interface ScraperFailure {
  source: string;
  status: "failed" | "timeout" | "partial";
  reason: string;
  lastTriedAt: Date;
  consecutiveFailures: number;
}

/**
 * Look at every scraper's most recent run within the last 24h. If the most
 * recent run failed, count back to find consecutive failures. Returns one
 * entry per source that's currently broken — empty array means all sources
 * are healthy or successfully ran.
 */
export async function getRecentScraperFailures(): Promise<ScraperFailure[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Pull recent runs grouped by source — Prisma can't do "row_number per group"
  // so we fetch and bucket in JS. Capped to 200 rows / source which is more
  // than enough to find the recent failure streak.
  const runs = await prisma.scraperRun.findMany({
    where: { startedAt: { gte: since } },
    orderBy: [{ source: "asc" }, { startedAt: "desc" }],
    select: {
      source: true,
      status: true,
      errorMessage: true,
      startedAt: true,
      jobsFound: true,
    },
    take: 200,
  });

  const bySource = new Map<string, typeof runs>();
  for (const r of runs) {
    if (!bySource.has(r.source)) bySource.set(r.source, []);
    bySource.get(r.source)!.push(r);
  }

  const failures: ScraperFailure[] = [];

  bySource.forEach((srcRuns, source) => {
    if (srcRuns.length === 0) return;
    const mostRecent = srcRuns[0];
    const isBroken =
      mostRecent.status === "failed" ||
      mostRecent.status === "timeout" ||
      (mostRecent.status === "partial" && mostRecent.jobsFound === 0);

    if (!isBroken) return;

    let consecutive = 0;
    for (const r of srcRuns) {
      const broken =
        r.status === "failed" ||
        r.status === "timeout" ||
        (r.status === "partial" && r.jobsFound === 0);
      if (broken) consecutive++;
      else break;
    }

    failures.push({
      source,
      status: mostRecent.status as ScraperFailure["status"],
      reason: humanizeReason(source, mostRecent.errorMessage, mostRecent.status),
      lastTriedAt: mostRecent.startedAt,
      consecutiveFailures: consecutive,
    });
  });

  return failures.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
}

/**
 * Turn the raw error message into something the user can act on.
 * If the scraper returned a useful message, lightly clean it up. Otherwise
 * fall back to known per-source patterns.
 */
function humanizeReason(source: string, raw: string | null | undefined, status: string): string {
  const msg = raw?.trim();

  // Status-first overrides — these are unambiguous regardless of message
  if (status === "timeout") return "Took too long to respond (likely network slow / rate-limited)";

  if (msg) {
    // Already-good messages from upstream — just tidy them
    if (/captcha|authwall/i.test(msg)) return "Blocked by login wall or captcha (job board doesn't trust datacenter IPs)";
    if (/api.?key|unauthorized|401|403/i.test(msg)) return "Upstream API key missing or rejected — check env vars";
    if (/rate.?limit|429/i.test(msg)) return "Hit upstream rate limit — backing off";
    if (/timeout|deadline/i.test(msg)) return "Took too long to respond (likely network slow / rate-limited)";
    if (/no\s+keywords/i.test(msg)) return "No keywords configured — add some in Settings";
    return msg.length > 140 ? msg.slice(0, 137) + "…" : msg;
  }

  // Generic fallbacks per source
  switch (source) {
    case "linkedin":
    case "linkedin_posts":
      return "Likely captcha or selector change (datacenter IPs blocked by LinkedIn)";
    case "indeed":
    case "jsearch":
      return "Probably missing or rate-limited RAPIDAPI_KEY";
    case "adzuna":
      return "Probably missing ADZUNA_APP_ID / ADZUNA_APP_KEY";
    case "google":
    case "google_jobs":
      return "Probably missing SERPAPI_KEY";
    case "rozee":
      return "Pakistan/MENA-only — quiet for global roles";
    default:
      return "Failed silently — no error captured";
  }
}
