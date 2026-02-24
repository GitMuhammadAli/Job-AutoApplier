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

const CRON_NAMES = [
  { key: "scrape-global", label: "Scrape Global", type: "scrape" },
  { key: "match-jobs", label: "Match Jobs", type: "cron" },
  { key: "match-all-users", label: "Match All Users", type: "cron" },
  { key: "instant-apply", label: "Instant Apply", type: "apply" },
  { key: "send-scheduled", label: "Send Scheduled", type: "send" },
  { key: "send-queued", label: "Send Queued", type: "send" },
  { key: "notify-matches", label: "Notify Matches", type: "notification" },
  { key: "cleanup-stale", label: "Cleanup Stale", type: "cron" },
  { key: "follow-up", label: "Follow Up", type: "follow-up" },
  { key: "check-follow-ups", label: "Check Follow Ups", type: "follow-up" },
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
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
      draftApps,
      readyApps,
      sendingApps,
      sentTotal,
      recentErrors,
      locks,
      jobsBySource,
      sentThisWeek,
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
      prisma.jobApplication.count({ where: { status: "DRAFT" } }),
      prisma.jobApplication.count({ where: { status: "READY" } }),
      prisma.jobApplication.count({ where: { status: "SENDING" } }),
      prisma.jobApplication.count({ where: { status: "SENT" } }),
      prisma.systemLog.findMany({
        where: { type: "error", createdAt: { gte: dayAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.systemLock.findMany(),
      prisma.globalJob.groupBy({
        by: ["source"],
        where: { isActive: true },
        _count: true,
      }),
      prisma.jobApplication.count({
        where: { status: "SENT", sentAt: { gte: weekAgo } },
      }),
    ]);

    // Scraper status
    const scraperStatus = await Promise.all(
      SCRAPE_SOURCES.map(async (source) => {
        const [lastLog, lastError, totalJobs] = await Promise.all([
          prisma.systemLog.findFirst({
            where: { type: "scrape", source },
            orderBy: { createdAt: "desc" },
          }),
          prisma.systemLog.findFirst({
            where: { type: "error", source },
            orderBy: { createdAt: "desc" },
          }),
          prisma.globalJob.count({ where: { source, isActive: true } }),
        ]);

        const meta = (lastLog?.metadata ?? {}) as Record<string, unknown>;
        return {
          source,
          lastRun: lastLog?.createdAt ?? null,
          lastMessage: lastLog?.message ?? null,
          jobCount: (meta.newJobs as number) ?? (meta.jobs as number) ?? 0,
          updatedCount: (meta.updatedJobs as number) ?? 0,
          totalJobs,
          isHealthy:
            !!lastLog &&
            (!lastError || lastLog.createdAt > lastError.createdAt),
          lastError: lastError?.message ?? null,
          lastErrorAt: lastError?.createdAt ?? null,
        };
      }),
    );

    // Cron status
    const cronStatus = await Promise.all(
      CRON_NAMES.map(async (cron) => {
        const lastLog = await prisma.systemLog.findFirst({
          where: {
            OR: [
              { source: cron.key },
              { type: cron.type, source: cron.key },
              { message: { contains: cron.key } },
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        const lock = locks.find((l) => l.name === cron.key);
        return {
          key: cron.key,
          label: cron.label,
          lastRun: lastLog?.createdAt ?? null,
          lastMessage: lastLog?.message ?? null,
          isRunning: lock?.isRunning ?? false,
          startedAt: lock?.startedAt ?? null,
        };
      }),
    );

    // Recently active users (last 24h)
    const recentlyActive = await prisma.userSettings.findMany({
      where: { lastVisitedAt: { gte: dayAgo } },
      select: {
        userId: true,
        fullName: true,
        lastVisitedAt: true,
        accountStatus: true,
        applicationMode: true,
        user: { select: { name: true, email: true, image: true, createdAt: true } },
      },
      orderBy: { lastVisitedAt: "desc" },
      take: 20,
    });

    const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000);

    // Quotas
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

    // Job distribution
    const sourceDistribution: Record<string, number> = {};
    for (const item of jobsBySource) {
      sourceDistribution[item.source] = item._count;
    }

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        paused: pausedUsers,
        neverOnboarded,
      },
      jobs: {
        active: activeJobs,
        inactive: inactiveJobs,
        fresh: freshJobs,
        sourceDistribution,
      },
      applicationsToday: {
        sent: sentToday,
        failed: failedToday,
        bounced: bouncedToday,
      },
      applicationPipeline: {
        draft: draftApps,
        ready: readyApps,
        sending: sendingApps,
        sentTotal,
        sentThisWeek,
      },
      scrapers: scraperStatus,
      crons: cronStatus,
      locks: locks.map((l) => ({
        name: l.name,
        isRunning: l.isRunning,
        startedAt: l.startedAt,
        completedAt: l.completedAt,
      })),
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
      recentlyActiveUsers: recentlyActive.map((s) => ({
        id: s.userId,
        name: s.fullName || s.user.name || s.user.email || "Unknown",
        email: s.user.email,
        image: s.user.image,
        lastActive: s.lastVisitedAt,
        isOnline: s.lastVisitedAt ? s.lastVisitedAt >= onlineThreshold : false,
        status: s.accountStatus || "unknown",
        mode: s.applicationMode || "MANUAL",
        joinedAt: s.user.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin/stats]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
