import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Unauthenticated health check for cron/monitoring. Reads recent scrape logs. */
export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [scrapeLogs, errorLogs, lock] = await Promise.all([
      prisma.systemLog.findMany({
        where: { type: "scrape", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.systemLog.findMany({
        where: { type: "error", source: { not: null }, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.systemLock.findUnique({
        where: { name: "scrape-global" },
      }),
    ]);

    const sourceStatus: Record<
      string,
      { lastSuccess: string | null; lastError: string | null; recentFound: number }
    > = {};

    for (const log of scrapeLogs) {
      const src = log.source || "unknown";
      if (!sourceStatus[src]) {
        sourceStatus[src] = { lastSuccess: null, lastError: null, recentFound: 0 };
      }
      const meta = log.metadata as { status?: string; found?: number } | null;
      if (meta?.status === "success" && !sourceStatus[src].lastSuccess) {
        sourceStatus[src].lastSuccess = log.createdAt.toISOString();
        sourceStatus[src].recentFound += meta.found ?? 0;
      }
    }

    for (const log of errorLogs) {
      const src = log.source || "unknown";
      if (!sourceStatus[src]) {
        sourceStatus[src] = { lastSuccess: null, lastError: null, recentFound: 0 };
      }
      if (!sourceStatus[src].lastError) {
        sourceStatus[src].lastError = log.createdAt.toISOString();
      }
    }

    const lastScrape = scrapeLogs[0];
    const status =
      errorLogs.length > 10 && scrapeLogs.length < 10
        ? "degraded"
        : lock?.isRunning
          ? "running"
          : "healthy";

    return NextResponse.json({
      status,
      lastScrape: lastScrape
        ? {
            at: lastScrape.createdAt.toISOString(),
            source: lastScrape.source,
            message: lastScrape.message,
            metadata: lastScrape.metadata,
          }
        : null,
      scrapeLock: lock
        ? { isRunning: lock.isRunning, startedAt: lock.startedAt }
        : null,
      sourceStatus,
      errorsLast24h: errorLogs.length,
    });
  } catch (error) {
    console.error("[health] Error:", error);
    return NextResponse.json(
      { status: "error", error: "Health check failed" },
      { status: 500 },
    );
  }
}
