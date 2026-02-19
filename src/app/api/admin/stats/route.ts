import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SCRAPE_SOURCES = [
  "indeed",
  "remotive",
  "arbeitnow",
  "linkedin",
  "rozee",
  "jsearch",
  "adzuna",
  "serpapi",
];

export async function GET() {
  const session = await getAuthSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    userCount,
    globalJobCount,
    applicationCount,
    sentToday,
    failedToday,
    recentErrors,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.globalJob.count(),
    prisma.jobApplication.count(),
    prisma.jobApplication.count({
      where: { status: "SENT", sentAt: { gte: todayStart } },
    }),
    prisma.jobApplication.count({
      where: { status: "FAILED", updatedAt: { gte: todayStart } },
    }),
    prisma.systemLog.findMany({
      where: { type: "error", createdAt: { gte: dayAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const scraperHealth = await Promise.all(
    SCRAPE_SOURCES.map(async (source) => {
      const [lastLog, jobsFound, errors] = await Promise.all([
        prisma.systemLog.findFirst({
          where: { type: "scrape", source },
          orderBy: { createdAt: "desc" },
        }),
        prisma.globalJob.count({ where: { source } }),
        prisma.systemLog.count({
          where: { type: "error", source, createdAt: { gte: dayAgo } },
        }),
      ]);
      return {
        source,
        lastRun: lastLog?.createdAt ?? null,
        jobsFound,
        errors,
      };
    })
  );

  const quotaLogs = await prisma.systemLog.groupBy({
    by: ["source"],
    where: { type: "api_call", createdAt: { gte: todayStart } },
    _count: true,
  });

  const quotas = quotaLogs.map((q) => ({
    name: q.source || "Unknown",
    used: q._count,
    limit: "varies",
  }));

  return NextResponse.json({
    userCount,
    globalJobCount,
    applicationCount,
    sentToday,
    failedToday,
    scraperHealth,
    recentErrors: recentErrors.map((e) => ({
      message: e.message,
      createdAt: e.createdAt,
      source: e.source,
    })),
    quotas,
  });
}
