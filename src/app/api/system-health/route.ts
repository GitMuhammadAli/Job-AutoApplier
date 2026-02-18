import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getAuthUserId();

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [
      recentLogs,
      todaySent,
      todayFailed,
      todayBounced,
      todayDrafted,
      locks,
      scrapeLogs,
    ] = await Promise.all([
      prisma.systemLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.jobApplication.count({
        where: { status: "SENT", sentAt: { gte: dayStart } },
      }),
      prisma.jobApplication.count({
        where: { status: "FAILED", updatedAt: { gte: dayStart } },
      }),
      prisma.jobApplication.count({
        where: { status: "BOUNCED", updatedAt: { gte: dayStart } },
      }),
      prisma.jobApplication.count({
        where: { status: "DRAFT", createdAt: { gte: dayStart } },
      }),
      prisma.systemLock.findMany(),
      prisma.systemLog.findMany({
        where: { type: "scrape", createdAt: { gte: dayStart } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const lastScrape = recentLogs.find((l) => l.type === "scrape");
    const lastInstant = recentLogs.find((l) => l.type === "instant-apply");
    const errors = recentLogs.filter((l) => l.type === "error");

    const sourceStats: Record<string, { found: number; errors: number }> = {};
    for (const log of scrapeLogs) {
      const source = log.source || "unknown";
      if (!sourceStats[source]) sourceStats[source] = { found: 0, errors: 0 };
      if (log.type === "error") {
        sourceStats[source].errors++;
      } else {
        const meta = log.metadata as Record<string, number> | null;
        sourceStats[source].found += meta?.found || 0;
      }
    }

    return NextResponse.json({
      status: errors.length > 5 ? "degraded" : "healthy",
      lastScrape: lastScrape
        ? { time: lastScrape.createdAt, message: lastScrape.message }
        : null,
      lastInstantApply: lastInstant
        ? { time: lastInstant.createdAt, message: lastInstant.message }
        : null,
      today: {
        sent: todaySent,
        failed: todayFailed,
        bounced: todayBounced,
        drafted: todayDrafted,
      },
      sourceStats,
      locks: locks.map((l) => ({
        name: l.name,
        isRunning: l.isRunning,
        startedAt: l.startedAt,
        completedAt: l.completedAt,
      })),
      recentErrors: errors.slice(0, 5).map((e) => ({
        source: e.source,
        message: e.message,
        time: e.createdAt,
      })),
    });
  } catch (error) {
    console.error("System health error:", error);
    return NextResponse.json({ error: "Failed to fetch health" }, { status: 500 });
  }
}
