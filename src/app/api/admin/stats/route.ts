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

    // Batch scraper stats: 3 queries instead of 48+
    const [
      jobCountsBySource,
      emailCountsBySource,
      skillCountsBySource,
      allScrapeLogs,
      allErrorLogs,
      recentJobSamples,
      totalSent,
      totalBounced,
      totalFailed,
      allCronLogs,
      recentlyActive,
      jsearchUsed,
      groqUsed,
      brevoUsed,
    ] = await Promise.all([
      // Job counts per source (active)
      prisma.globalJob.groupBy({
        by: ["source"],
        where: { isActive: true },
        _count: true,
      }),
      // Jobs with email per source
      prisma.globalJob.groupBy({
        by: ["source"],
        where: { isActive: true, companyEmail: { not: null } },
        _count: true,
      }),
      // Jobs with skills per source
      prisma.globalJob.groupBy({
        by: ["source"],
        where: { isActive: true, skills: { isEmpty: false } },
        _count: true,
      }),
      // Last scrape log per source (fetch recent, dedupe in JS)
      prisma.systemLog.findMany({
        where: { type: "scrape", source: { in: SCRAPE_SOURCES } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // Last error per source
      prisma.systemLog.findMany({
        where: { type: "error", source: { in: SCRAPE_SOURCES } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // Recent jobs for skill/category analysis (all sources, single query)
      prisma.globalJob.findMany({
        where: { isActive: true, source: { in: SCRAPE_SOURCES } },
        select: { source: true, skills: true, category: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
      // Email delivery stats
      prisma.jobApplication.count({ where: { status: "SENT" } }),
      prisma.jobApplication.count({ where: { status: "BOUNCED" } }),
      prisma.jobApplication.count({ where: { status: "FAILED" } }),
      // Cron logs — single batch query for all cron sources
      prisma.systemLog.findMany({
        where: {
          source: { in: CRON_NAMES.map((c) => c.key) },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // Recently active users
      prisma.userSettings.findMany({
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
      }),
      // Quotas
      prisma.systemLog.count({
        where: { type: { in: ["api_usage", "api_call"] }, source: "jsearch", createdAt: { gte: startOfMonth } },
      }),
      prisma.systemLog.count({
        where: { type: { in: ["api_usage", "api_call"] }, source: "groq", createdAt: { gte: startOfDay } },
      }),
      prisma.activity.count({
        where: { type: "NOTIFICATION_SENT", createdAt: { gte: startOfDay } },
      }),
    ]);

    // Build lookup maps from batch results
    const jobCountMap = new Map(jobCountsBySource.map((r) => [r.source, r._count]));
    const emailCountMap = new Map(emailCountsBySource.map((r) => [r.source, r._count]));
    const skillCountMap = new Map(skillCountsBySource.map((r) => [r.source, r._count]));

    // Dedupe logs to get last per source
    const lastLogBySource = new Map<string, typeof allScrapeLogs[0]>();
    for (const log of allScrapeLogs) {
      if (log.source && !lastLogBySource.has(log.source)) {
        lastLogBySource.set(log.source, log);
      }
    }
    const lastErrorBySource = new Map<string, typeof allErrorLogs[0]>();
    for (const log of allErrorLogs) {
      if (log.source && !lastErrorBySource.has(log.source)) {
        lastErrorBySource.set(log.source, log);
      }
    }

    // Build skill/category maps per source from sampled jobs
    const scraperStatus = SCRAPE_SOURCES.map((source) => {
      const totalJobs = jobCountMap.get(source) ?? 0;
      const withEmail = emailCountMap.get(source) ?? 0;
      const withSkills = skillCountMap.get(source) ?? 0;
      const lastLog = lastLogBySource.get(source);
      const lastError = lastErrorBySource.get(source);
      const meta = (lastLog?.metadata ?? {}) as Record<string, unknown>;

      const sourceJobs = recentJobSamples.filter((j) => j.source === source);
      const skillCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      for (const job of sourceJobs) {
        for (const skill of job.skills ?? []) {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
        if (job.category) {
          categoryCounts[job.category] = (categoryCounts[job.category] || 0) + 1;
        }
      }
      const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
      const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

      return {
        source,
        lastRun: lastLog?.createdAt ?? null,
        lastMessage: lastLog?.message ?? null,
        jobCount: (meta.newJobs as number) ?? (meta.jobs as number) ?? 0,
        updatedCount: (meta.updatedJobs as number) ?? 0,
        totalJobs,
        withEmail,
        withSkills,
        emailRate: totalJobs > 0 ? Math.round((withEmail / totalJobs) * 100) : 0,
        skillRate: totalJobs > 0 ? Math.round((withSkills / totalJobs) * 100) : 0,
        topSkills,
        topCategories,
        isHealthy: !!lastLog && (!lastError || lastLog.createdAt > lastError.createdAt),
        lastError: lastError?.message ?? null,
        lastErrorAt: lastError?.createdAt ?? null,
      };
    });

    const deliveryRate = totalSent + totalBounced > 0 ? Math.round((totalSent / (totalSent + totalBounced)) * 100) : 100;
    const totalActiveWithEmail = scraperStatus.reduce((sum, s) => sum + s.withEmail, 0);
    const totalActive = scraperStatus.reduce((sum, s) => sum + s.totalJobs, 0);
    const overallEmailRate = totalActive > 0 ? Math.round((totalActiveWithEmail / totalActive) * 100) : 0;

    // Cron status — dedupe from batch query
    const lastCronLogBySource = new Map<string, typeof allCronLogs[0]>();
    for (const log of allCronLogs) {
      if (log.source && !lastCronLogBySource.has(log.source)) {
        lastCronLogBySource.set(log.source, log);
      }
    }
    const cronStatus = CRON_NAMES.map((cron) => {
      const lastLog = lastCronLogBySource.get(cron.key);
      const lock = locks.find((l) => l.name === cron.key);
      return {
        key: cron.key,
        label: cron.label,
        lastRun: lastLog?.createdAt ?? null,
        lastMessage: lastLog?.message ?? null,
        isRunning: lock?.isRunning ?? false,
        startedAt: lock?.startedAt ?? null,
      };
    });

    const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000);

    // Job distribution
    const sourceDistribution: Record<string, number> = {};
    for (const item of jobsBySource) {
      sourceDistribution[item.source] = item._count;
    }

    const response = NextResponse.json({
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
      quality: {
        overallEmailRate,
        deliveryRate,
        totalBounced,
        totalSent,
        totalFailed,
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
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    console.error("[admin/stats]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
