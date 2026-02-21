import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
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
  "google",
];

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      pausedUsers,
      neverOnboarded,
      activeJobs,
      inactiveJobs,
      freshJobs,
      sentToday,
      failedToday,
      bouncedToday,
      recentErrors,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userSettings.count({ where: { accountStatus: "active" } }),
      prisma.userSettings.count({ where: { accountStatus: "paused" } }),
      prisma.userSettings.count({ where: { isOnboarded: false } }),
      prisma.globalJob.count({ where: { isActive: true } }),
      prisma.globalJob.count({ where: { isActive: false } }),
      prisma.globalJob.count({ where: { isFresh: true } }),
      prisma.jobApplication.count({
        where: { status: "SENT", sentAt: { gte: startOfDay } },
      }),
      prisma.jobApplication.count({
        where: { status: "FAILED", updatedAt: { gte: startOfDay } },
      }),
      prisma.jobApplication.count({
        where: { status: "BOUNCED", updatedAt: { gte: startOfDay } },
      }),
      prisma.systemLog.findMany({
        where: { type: "error", createdAt: { gte: dayAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const scraperStatus = await Promise.all(
      SCRAPE_SOURCES.map(async (source) => {
        const [lastLog, lastError] = await Promise.all([
          prisma.systemLog.findFirst({
            where: { type: "scrape", source },
            orderBy: { createdAt: "desc" },
          }),
          prisma.systemLog.findFirst({
            where: { type: "error", source },
            orderBy: { createdAt: "desc" },
          }),
        ]);
        return {
          source,
          lastRun: lastLog?.createdAt ?? null,
          lastMessage: lastLog?.message ?? null,
          jobCount: (lastLog?.metadata as Record<string, number>)?.jobs ?? 0,
          isHealthy:
            !!lastLog &&
            (!lastError || lastLog.createdAt > lastError.createdAt),
          lastError: lastError?.message ?? null,
        };
      }),
    );

    const [jsearchUsed, groqUsed, brevoUsed] = await Promise.all([
      prisma.systemLog.count({
        where: {
          type: { in: ["api_usage", "api_call"] },
          source: "jsearch",
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.systemLog.count({
        where: {
          type: { in: ["api_usage", "api_call"] },
          source: "groq",
          createdAt: { gte: startOfDay },
        },
      }),
      prisma.activity.count({
        where: { type: "NOTIFICATION_SENT", createdAt: { gte: startOfDay } },
      }),
    ]);

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        paused: pausedUsers,
        neverOnboarded,
      },
      jobs: { active: activeJobs, inactive: inactiveJobs, fresh: freshJobs },
      applicationsToday: {
        sent: sentToday,
        failed: failedToday,
        bounced: bouncedToday,
      },
      scrapers: scraperStatus,
      quotas: {
        jsearch: { used: jsearchUsed, limit: 200, period: "month" },
        groq: { used: groqUsed, limit: 14400, period: "day" },
        brevo: { used: brevoUsed, limit: 300, period: "day" },
      },
      recentErrors: recentErrors.map((e) => ({
        message: e.message,
        createdAt: e.createdAt,
        source: e.source,
      })),
    });
  } catch (error) {
    console.error("[admin/stats]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
