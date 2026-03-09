import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_DAYS, STUCK_SENDING_TIMEOUT_MS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("cleanup-stale");

  try {
    const now = new Date();
    let totalMarkedInactive = 0;
    const perSource: Record<string, number> = {};

    // Per-source stale detection
    for (const [source, days] of Object.entries(STALE_DAYS)) {
      if (source === "default") continue;

      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.globalJob.updateMany({
        where: {
          source,
          lastSeenAt: { lt: cutoff },
          isActive: true,
        },
        data: { isActive: false },
      });

      if (result.count > 0) {
        perSource[source] = result.count;
        totalMarkedInactive += result.count;
      }
    }

    // Default for any source not explicitly configured
    const defaultCutoff = new Date(now.getTime() - (STALE_DAYS.default ?? 7) * 24 * 60 * 60 * 1000);
    const configuredSources = Object.keys(STALE_DAYS).filter(s => s !== "default");
    const defaultResult = await prisma.globalJob.updateMany({
      where: {
        source: { notIn: configuredSources },
        lastSeenAt: { lt: defaultCutoff },
        isActive: true,
      },
      data: { isActive: false },
    });
    if (defaultResult.count > 0) {
      perSource["other"] = defaultResult.count;
      totalMarkedInactive += defaultResult.count;
    }

    // URL liveness check: HEAD-request a batch of old active jobs to find dead listings
    let deadUrlCount = 0;
    try {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const candidates = await prisma.globalJob.findMany({
        where: {
          isActive: true,
          applyUrl: { not: null },
          lastSeenAt: { lt: threeDaysAgo },
        },
        select: { id: true, applyUrl: true },
        orderBy: { lastSeenAt: "asc" },
        take: 15,
      });

      const deadIds: string[] = [];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      await Promise.allSettled(
        candidates.map(async (job) => {
          if (!job.applyUrl) return;
          try {
            const res = await fetch(job.applyUrl, {
              method: "HEAD",
              redirect: "follow",
              signal: controller.signal,
              headers: { "User-Agent": "JobPilot-LinkChecker/1.0" },
            });
            if (res.status === 404 || res.status === 410 || res.status === 403) {
              deadIds.push(job.id);
            }
          } catch {
            // Network errors are inconclusive — skip
          }
        }),
      );

      clearTimeout(timeout);

      if (deadIds.length > 0) {
        const result = await prisma.globalJob.updateMany({
          where: { id: { in: deadIds } },
          data: { isActive: false },
        });
        deadUrlCount = result.count;
      }
    } catch (e) {
      console.warn("[CleanupStale] URL liveness check failed:", e);
    }

    // Dead letter recovery: unstick SENDING apps older than 10 min
    const stuckCutoff = new Date(Date.now() - STUCK_SENDING_TIMEOUT_MS);
    const stuckRecovered = await prisma.jobApplication.updateMany({
      where: {
        status: "SENDING",
        updatedAt: { lt: stuckCutoff },
      },
      data: { status: "FAILED", errorMessage: "Stuck in SENDING state — recovered by cleanup cron" },
    });

    // Prune old SystemLog entries (keep last 30 days)
    const logCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prunedLogs = await prisma.systemLog.deleteMany({
      where: { createdAt: { lt: logCutoff } },
    });

    // Delete very old inactive jobs (90 days) with no UserJob references
    const oldInactiveCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oldInactiveJobs = await prisma.globalJob.findMany({
      where: {
        isActive: false,
        createdAt: { lt: oldInactiveCutoff },
        userJobs: { none: {} },
      },
      select: { id: true },
      take: 1000,
    });
    let deletedOldJobs = 0;
    if (oldInactiveJobs.length > 0) {
      const result = await prisma.globalJob.deleteMany({
        where: {
          id: { in: oldInactiveJobs.map((j) => j.id) },
          userJobs: { none: {} },
        },
      });
      deletedOldJobs = result.count;
    }

    // Prune old ScraperRun records (keep last 30 days)
    let prunedRuns = 0;
    try {
      const runResult = await prisma.scraperRun.deleteMany({
        where: { startedAt: { lt: logCutoff } },
      });
      prunedRuns = runResult.count;
    } catch {
      // ScraperRun table may not exist yet
    }

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "cleanup-stale",
        message: `Marked ${totalMarkedInactive} inactive, ${deadUrlCount} dead URLs, deleted ${deletedOldJobs} old jobs, recovered ${stuckRecovered.count} stuck, pruned ${prunedLogs.count} logs + ${prunedRuns} runs`,
        metadata: {
          markedInactive: totalMarkedInactive,
          deadUrlCount,
          perSource,
          deletedOldJobs,
          stuckRecovered: stuckRecovered.count,
          prunedLogs: prunedLogs.count,
          prunedRuns,
        },
      },
    });

    await tracker.success({ processed: totalMarkedInactive + deadUrlCount, metadata: { deadUrlCount, deletedOldJobs, stuckRecovered: stuckRecovered.count, prunedLogs: prunedLogs.count, prunedRuns } });

    return NextResponse.json({
      success: true,
      markedInactive: totalMarkedInactive,
      deadUrls: deadUrlCount,
      perSource,
      deletedOldJobs,
      stuckRecovered: stuckRecovered.count,
      prunedLogs: prunedLogs.count,
      prunedRuns,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("CleanupStale", error, "Cleanup failed");
  }
}
