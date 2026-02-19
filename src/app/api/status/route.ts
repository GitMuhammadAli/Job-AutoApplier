import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { lastVisitedAt: true },
    });

    const [
      lastScrape,
      scrapeLock,
      lastApply,
      totalJobs,
      newJobsCount,
      recentWarnings,
    ] = await Promise.all([
      prisma.systemLog.findFirst({
        where: { type: "scrape" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.systemLock.findUnique({
        where: { name: "scrape-global" },
      }),
      prisma.systemLog.findFirst({
        where: { type: "apply" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userJob.count({ where: { userId } }),
      prisma.userJob.count({
        where: {
          userId,
          createdAt: { gte: settings?.lastVisitedAt ?? new Date(0) },
        },
      }),
      prisma.systemLog.findMany({
        where: {
          type: "error",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    await prisma.userSettings.update({
      where: { userId },
      data: { lastVisitedAt: new Date() },
    });

    const lastScrapeAt = lastScrape?.createdAt ?? null;
    let nextScrapeIn = 30;
    if (lastScrapeAt) {
      const elapsed = (Date.now() - lastScrapeAt.getTime()) / 60000;
      nextScrapeIn = Math.max(0, Math.round(30 - elapsed));
    }

    return NextResponse.json({
      lastScrapeAt,
      lastScrapeResults: lastScrape?.metadata ?? null,
      scrapeRunning: scrapeLock?.isRunning ?? false,
      newJobsCount: settings?.lastVisitedAt ? newJobsCount : 0,
      totalJobs,
      recentAutoApply: lastApply?.metadata ?? null,
      warnings: recentWarnings.map((w) => w.message),
      nextScrapeIn,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
