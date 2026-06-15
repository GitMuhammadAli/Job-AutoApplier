/**
 * Scraper runner wrapper — handles timeout, retry, fallback, and run recording.
 * Every scraper cron calls this instead of raw scraper functions.
 */

import { prisma } from "@/lib/prisma";
import { STALE_DAYS } from "@/lib/constants";
import type { ScrapedJob, SearchQuery } from "@/types";

export interface ScraperRunResult {
  source: string;
  jobs: ScrapedJob[];
  status: "success" | "partial" | "failed" | "timeout";
  errorMessage?: string;
  durationMs: number;
  runId: string;
}

interface RunScraperOptions {
  source: string;
  fn: (queries: SearchQuery[]) => Promise<ScrapedJob[]>;
  queries: SearchQuery[];
  timeoutMs?: number;
  fallbackFn?: (queries: SearchQuery[]) => Promise<ScrapedJob[]>;
  fallbackSource?: string;
}

/**
 * Circuit breaker: after N consecutive timeouts/failures within the look-back
 * window, suspend a scraper for COOLDOWN_MS so we stop wasting the cron
 * function's runtime on a known-broken endpoint. State lives in ScraperRun
 * rows so it survives cold starts — no in-memory map.
 */
const CB_FAILURES_TO_OPEN = 3;
const CB_LOOKBACK_RUNS = 5;
const CB_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

async function isCircuitOpen(source: string): Promise<{ open: boolean; until?: Date; reason?: string }> {
  const recent = await prisma.scraperRun.findMany({
    where: { source },
    orderBy: { startedAt: "desc" },
    take: CB_LOOKBACK_RUNS,
    select: { status: true, startedAt: true, errorMessage: true },
  }).catch(() => [] as Array<{ status: string; startedAt: Date; errorMessage: string | null }>);

  if (recent.length < CB_FAILURES_TO_OPEN) return { open: false };

  const recentFails = recent.slice(0, CB_FAILURES_TO_OPEN);
  const allFailed = recentFails.every((r) => r.status === "timeout" || r.status === "failed");
  if (!allFailed) return { open: false };

  const lastFailureAt = recentFails[0].startedAt;
  const elapsed = Date.now() - lastFailureAt.getTime();
  if (elapsed >= CB_COOLDOWN_MS) return { open: false };

  return {
    open: true,
    until: new Date(lastFailureAt.getTime() + CB_COOLDOWN_MS),
    reason: recentFails[0].errorMessage ?? "consecutive failures",
  };
}

/**
 * Operator-managed denylist. Set `DISABLED_SCRAPERS=rozee,google,indeed` to
 * graceful-skip those sources without a code change. Useful when an upstream
 * (SerpAPI, RapidAPI, etc.) has quota-burnt and you don't want the scraper
 * cron to keep accumulating "failed" rows that eventually trip the circuit
 * breaker — every disabled run lands as `skipped`, breaker stays clear, and
 * removing the env value (or comma-separated entry) instantly re-enables.
 *
 * Names match the `source` string the runner is called with — verify in
 * src/app/api/cron/scrape-global/route.ts SCRAPERS map.
 */
function isSourceDisabled(source: string): boolean {
  const raw = process.env.DISABLED_SCRAPERS;
  if (!raw) return false;
  const denylist = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return denylist.includes(source.toLowerCase());
}

export async function runScraper(opts: RunScraperOptions): Promise<ScraperRunResult> {
  const { source, fn, queries, timeoutMs = 8000, fallbackFn, fallbackSource } = opts;
  const startedAt = new Date();

  // Operator denylist runs BEFORE the circuit breaker so a quota-burnt scraper
  // doesn't accumulate failures while disabled.
  if (isSourceDisabled(source)) {
    const run = await prisma.scraperRun.create({
      data: {
        source,
        status: "skipped",
        startedAt,
        completedAt: new Date(),
        durationMs: 0,
        jobsFound: 0,
        errorMessage: "Disabled via DISABLED_SCRAPERS env",
      },
    }).catch(() => null);
    return {
      source,
      jobs: [],
      status: "failed",
      durationMs: 0,
      runId: run?.id ?? "unknown",
      errorMessage: "Disabled via DISABLED_SCRAPERS env",
    };
  }

  // Circuit breaker: short-circuit before spending function time on a
  // scraper that's been timing out for a while. Recorded as a ScraperRun
  // so the dashboard / health endpoint can show "tripped" honestly.
  const breaker = await isCircuitOpen(source);
  if (breaker.open) {
    const run = await prisma.scraperRun.create({
      data: {
        source,
        status: "skipped",
        startedAt,
        completedAt: new Date(),
        durationMs: 0,
        jobsFound: 0,
        errorMessage: `Circuit breaker OPEN — last failure: ${breaker.reason}. Resumes ${breaker.until?.toISOString() ?? "soon"}.`,
      },
    }).catch(() => null);
    return {
      source,
      jobs: [],
      status: "failed",
      durationMs: 0,
      runId: run?.id ?? "unknown",
      errorMessage: `Circuit breaker open until ${breaker.until?.toISOString() ?? "?"}`,
    };
  }

  // Create a run record
  const run = await prisma.scraperRun.create({
    data: { source, status: "running", startedAt },
  }).catch((err) => {
    console.error(`[ScraperRunner] Failed to create ScraperRun for ${source}:`, err instanceof Error ? err.message : err);
    return null;
  });
  const runId = run?.id ?? "unknown";

  try {
    const jobs = await withTimeout(fn(queries), timeoutMs);
    const durationMs = Date.now() - startedAt.getTime();

    if (jobs.length === 0 && fallbackFn) {
      const elapsed = Date.now() - startedAt.getTime();
      const remainingMs = timeoutMs - elapsed;
      if (remainingMs < 1000) {
        console.warn(`[ScraperRunner] ${source} returned 0 jobs, no time for fallback (${remainingMs}ms left)`);
        await updateRun(runId, { status: "failed", jobsFound: 0, durationMs: elapsed, errorMessage: "Primary returned 0, insufficient time for fallback" });
        return { source, jobs: [], status: "failed", durationMs: elapsed, runId, errorMessage: "Primary returned 0, no time for fallback" };
      }
      console.warn(`[ScraperRunner] ${source} returned 0 jobs, trying fallback ${fallbackSource || "unknown"} (${remainingMs}ms remaining)`);
      try {
        const fallbackJobs = await withTimeout(fallbackFn(queries), remainingMs);
        const totalDuration = Date.now() - startedAt.getTime();
        await updateRun(runId, {
          status: fallbackJobs.length > 0 ? "partial" : "failed",
          jobsFound: fallbackJobs.length,
          durationMs: totalDuration,
          errorMessage: `Primary returned 0, fallback (${fallbackSource}) returned ${fallbackJobs.length}`,
        });
        return {
          source,
          jobs: fallbackJobs,
          status: fallbackJobs.length > 0 ? "partial" : "failed",
          durationMs: totalDuration,
          runId,
          errorMessage: `Primary returned 0, used fallback ${fallbackSource}`,
        };
      } catch (fallbackErr) {
        const totalDuration = Date.now() - startedAt.getTime();
        const errMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        await updateRun(runId, {
          status: "failed",
          jobsFound: 0,
          durationMs: totalDuration,
          errorMessage: `Primary returned 0, fallback also failed: ${errMsg}`,
        });
        return {
          source,
          jobs: [],
          status: "failed",
          durationMs: totalDuration,
          runId,
          errorMessage: `Primary returned 0, fallback failed: ${errMsg}`,
        };
      }
    }

    await updateRun(runId, {
      status: "success",
      jobsFound: jobs.length,
      durationMs,
    });

    return { source, jobs, status: "success", durationMs, runId };
  } catch (err) {
    const durationMs = Date.now() - startedAt.getTime();
    const isTimeout = err instanceof Error && err.message === "SCRAPER_TIMEOUT";
    const errMsg = isTimeout ? `Timeout after ${timeoutMs}ms` : (err instanceof Error ? err.message : String(err));
    const status = isTimeout ? "timeout" : "failed";

    // Try fallback on error with remaining time budget
    if (fallbackFn && timeoutMs - durationMs >= 1000) {
      try {
        const remainingMs = timeoutMs - durationMs;
        console.warn(`[ScraperRunner] ${source} failed, trying fallback ${fallbackSource || "unknown"} (${remainingMs}ms remaining)`);
        const fallbackJobs = await withTimeout(fallbackFn(queries), remainingMs);
        const totalDuration = Date.now() - startedAt.getTime();
        await updateRun(runId, {
          status: fallbackJobs.length > 0 ? "partial" : "failed",
          jobsFound: fallbackJobs.length,
          durationMs: totalDuration,
          errorMessage: `Primary ${status}: ${errMsg}. Fallback (${fallbackSource}) returned ${fallbackJobs.length}`,
        });
        return {
          source,
          jobs: fallbackJobs,
          status: fallbackJobs.length > 0 ? "partial" : "failed",
          durationMs: totalDuration,
          runId,
          errorMessage: `Primary ${status}, used fallback ${fallbackSource}`,
        };
      } catch (fallbackErr) {
        console.warn(`[ScraperRunner] Fallback ${fallbackSource || "unknown"} also failed:`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      }
    }

    await updateRun(runId, {
      status,
      jobsFound: 0,
      durationMs,
      errorMessage: errMsg,
    });

    await prisma.systemLog.create({
      data: {
        type: "scrape-detail",
        source,
        message: `${source}: FAILED — ${errMsg}`,
        metadata: {
          error: errMsg,
          errorType: isTimeout ? "timeout" : (err instanceof Error ? err.name : "unknown"),
          partialResults: 0,
          durationMs,
        },
      },
    }).catch(() => {});

    return { source, jobs: [], status, durationMs, runId, errorMessage: errMsg };
  }
}

async function updateRun(
  runId: string,
  data: { status: string; jobsFound: number; durationMs: number; errorMessage?: string; jobsSaved?: number }
) {
  if (runId === "unknown") return;
  await prisma.scraperRun.update({
    where: { id: runId },
    data: {
      status: data.status,
      jobsFound: data.jobsFound,
      jobsSaved: data.jobsSaved ?? 0,
      durationMs: data.durationMs,
      errorMessage: data.errorMessage,
      completedAt: new Date(),
    },
  }).catch((e) => console.warn("[ScraperRunner] Failed to update run:", e));
}

export async function updateRunJobsSaved(runId: string, jobsSaved: number) {
  if (runId === "unknown") return;
  await prisma.scraperRun.update({
    where: { id: runId },
    data: { jobsSaved },
  }).catch((e) => console.warn("[ScraperRunner] Failed to update jobsSaved:", e));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SCRAPER_TIMEOUT")), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Get health status for all scrapers based on ScraperRun records.
 */
export async function getScraperHealthStatus(): Promise<Record<string, {
  status: "healthy" | "degraded" | "broken" | "stale";
  lastRun: Date | null;
  lastJobCount: number;
  consecutiveFailures: number;
  lastError: string | null;
  recentRuns: Array<{ status: string; jobsFound: number; startedAt: Date }>;
}>> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Get last 5 runs per source
  const recentRuns = await prisma.scraperRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const bySource: Record<string, typeof recentRuns> = {};
  for (const run of recentRuns) {
    if (!bySource[run.source]) bySource[run.source] = [];
    if (bySource[run.source].length < 5) {
      bySource[run.source].push(run);
    }
  }

  const result: Record<string, {
    status: "healthy" | "degraded" | "broken" | "stale";
    lastRun: Date | null;
    lastJobCount: number;
    consecutiveFailures: number;
    lastError: string | null;
    recentRuns: Array<{ status: string; jobsFound: number; startedAt: Date }>;
  }> = {};

  // A6: Derive sources dynamically from DB records + STALE_DAYS config instead of hardcoded list
  const configuredSources = Object.keys(STALE_DAYS).filter(s => s !== "default" && s !== "manual");
  const dbSources = Object.keys(bySource);
  const allSources = Array.from(new Set([...configuredSources, ...dbSources]));

  for (const source of allSources) {
    const runs = bySource[source] || [];
    if (runs.length === 0) {
      result[source] = {
        status: "stale",
        lastRun: null,
        lastJobCount: 0,
        consecutiveFailures: 0,
        lastError: null,
        recentRuns: [],
      };
      continue;
    }

    const lastRun = runs[0];
    let consecutiveFailures = 0;
    for (const r of runs) {
      if (r.status === "success" || r.status === "partial") break;
      // Skipped runs (circuit-breaker tripped) count as failure days for
      // health surfacing — the scraper IS broken, the breaker is just
      // saving us function time.
      consecutiveFailures++;
    }

    let status: "healthy" | "degraded" | "broken" | "stale";
    if (lastRun.startedAt < sixHoursAgo && lastRun.status !== "running") {
      status = "stale";
    } else if (lastRun.status === "success") {
      status = "healthy";
    } else if (consecutiveFailures >= 3) {
      status = "broken";
    } else {
      status = "degraded";
    }

    // Detect stuck runs (running > 10 min)
    if (lastRun.status === "running") {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (lastRun.startedAt < tenMinAgo) {
        status = "broken";
      }
    }

    const lastError = runs.find((r) => r.errorMessage)?.errorMessage ?? null;

    result[source] = {
      status,
      lastRun: lastRun.startedAt,
      lastJobCount: lastRun.jobsFound,
      consecutiveFailures,
      lastError,
      recentRuns: runs.map((r) => ({
        status: r.status,
        jobsFound: r.jobsFound,
        startedAt: r.startedAt,
      })),
    };
  }

  return result;
}
