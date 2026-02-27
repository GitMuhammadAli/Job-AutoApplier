import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userIsAdmin = isAdmin(session.user.email);
    const userId = (session.user as { id?: string }).id;

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const userFilter = userIsAdmin ? {} : { userId: userId ?? "" };

    const [
      recentLogs,
      todaySent,
      todayFailed,
      todayBounced,
      todayDrafted,
      locks,
      scrapeLogs,
    ] = await Promise.all([
      // Only admins see system logs
      userIsAdmin
        ? prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
        : Promise.resolve([]),
      prisma.jobApplication.count({
        where: { ...userFilter, status: "SENT", sentAt: { gte: dayStart } },
      }),
      prisma.jobApplication.count({
        where: { ...userFilter, status: "FAILED", updatedAt: { gte: dayStart } },
      }),
      prisma.jobApplication.count({
        where: { ...userFilter, status: "BOUNCED", updatedAt: { gte: dayStart } },
      }),
      prisma.jobApplication.count({
        where: { ...userFilter, status: "DRAFT", createdAt: { gte: dayStart } },
      }),
      // Only admins see lock state
      userIsAdmin ? prisma.systemLock.findMany() : Promise.resolve([]),
      userIsAdmin
        ? prisma.systemLog.findMany({
            where: { type: "scrape", createdAt: { gte: dayStart } },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    const lastScrape = recentLogs.find((l) => l.type === "scrape");
    const lastInstant = recentLogs.find((l) => l.type === "instant-apply");
    // Check for actual errors: type "error" OR messages containing failure indicators
    const errors = recentLogs.filter((l) =>
      l.type === "error" ||
      (l.message && (l.message.includes("failed") || l.message.includes("Failed") || l.message.includes("0 jobs")))
    );

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

    const response = NextResponse.json({
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
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
    return response;
  } catch (error) {
    console.error("System health error:", error);
    return NextResponse.json({ error: "Failed to fetch health" }, { status: 500 });
  }
}
