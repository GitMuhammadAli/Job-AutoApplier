/**
 * Scraper runner wrapper — handles timeout, retry, fallback, and run recording.
 * Every scraper cron calls this instead of raw scraper functions.
 */

import { prisma } from "@/lib/prisma";
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

export async function runScraper(opts: RunScraperOptions): Promise<ScraperRunResult> {
  const { source, fn, queries, timeoutMs = 45000, fallbackFn, fallbackSource } = opts;
  const startedAt = new Date();

  // Create a run record
  const run = await prisma.scraperRun.create({
    data: { source, status: "running", startedAt },
  }).catch(() => null);
  const runId = run?.id ?? "unknown";

  try {
    const jobs = await withTimeout(fn(queries), timeoutMs);
    const durationMs = Date.now() - startedAt.getTime();

    if (jobs.length === 0 && fallbackFn) {
      // Primary returned 0 — try fallback with remaining time budget
      const elapsed = Date.now() - startedAt.getTime();
      const remainingMs = Math.max(timeoutMs - elapsed, 5000);
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
    if (fallbackFn) {
      try {
        const remainingMs = Math.max(timeoutMs - durationMs, 5000);
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
      } catch {
        // Fallback also failed, fall through
      }
    }

    await updateRun(runId, {
      status,
      jobsFound: 0,
      durationMs,
      errorMessage: errMsg,
    });

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

  const allSources = ["linkedin", "indeed", "jsearch", "google", "remotive", "arbeitnow", "adzuna", "rozee"];

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
