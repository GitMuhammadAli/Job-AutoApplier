"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

const EMPTY_ANALYTICS = {
  totalJobs: 0,
  applied: 0,
  interviews: 0,
  offers: 0,
  rejected: 0,
  ghosted: 0,
  responseRate: 0,
  applicationsOverTime: [] as { week: string; count: number }[],
  stageFunnel: [
    { stage: "Saved", count: 0 },
    { stage: "Applied", count: 0 },
    { stage: "Interview", count: 0 },
    { stage: "Offer", count: 0 },
  ],
  sourceBreakdown: [] as { source: string; count: number }[],
  activityOverTime: [] as { week: string; count: number }[],
  speedMetrics: {
    avgApplyMinutes: 0,
    fastApplyCount: 0,
    totalSent: 0,
    instantCount: 0,
  },
  applyMethodBreakdown: [] as { method: string; count: number }[],
  speedOverTime: [] as { date: string; avgMinutes: number }[],
  matchScoreDistribution: [
    { range: "0-20%", count: 0 },
    { range: "21-40%", count: 0 },
    { range: "41-60%", count: 0 },
    { range: "61-80%", count: 0 },
    { range: "81-100%", count: 0 },
  ],
  responseRateBreakdown: [] as { name: string; value: number }[],
  topCompanies: [] as { company: string; count: number }[],
  keywordEffectiveness: [] as { keyword: string; matches: number; saves: number; dismisses: number; applied: number }[],
  weeklyComparison: {
    thisWeek: { applications: 0, matches: 0 },
    lastWeek: { applications: 0, matches: 0 },
  },
  summary: {
    totalJobs: 0,
    totalApplications: 0,
    totalSent: 0,
    avgMatchScore: 0,
    responseRatePercent: 0,
  },
};

export async function getAnalytics() {
  try {
    const userId = await getAuthUserId();

    const now2 = new Date();
    const thisWeekStart = new Date(now2);
    thisWeekStart.setDate(now2.getDate() - now2.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);

    // Single parallel batch for ALL data — was 8+ sequential queries before
    const [
      userJobs,
      activityWeekly,
      thisWeekApps,
      lastWeekApps,
      thisWeekMatches,
      lastWeekMatches,
      totalApplications,
      userSettings,
    ] = await Promise.all([
      prisma.userJob.findMany({
        where: { userId, isDismissed: false },
        select: {
          stage: true,
          matchScore: true,
          matchReasons: true,
          isDismissed: true,
          createdAt: true,
          globalJob: {
            select: { source: true, firstSeenAt: true, title: true, skills: true, company: true },
          },
          application: {
            select: { status: true, sentAt: true, appliedVia: true },
          },
        },
        take: 2000,
      }),

      // Use groupBy for activity counts instead of fetching 5000 raw records
      prisma.$queryRaw<{ week: string; count: bigint }[]>`
        SELECT TO_CHAR(DATE_TRUNC('week', "createdAt"), 'IYYY-"W"IW') as week,
               COUNT(*)::bigint as count
        FROM "Activity"
        WHERE "userId" = ${userId}
          AND "createdAt" > NOW() - INTERVAL '90 days'
        GROUP BY DATE_TRUNC('week', "createdAt")
        ORDER BY week DESC
        LIMIT 12
      `.catch(() => [] as { week: string; count: bigint }[]),

      prisma.jobApplication.count({
        where: { userId, createdAt: { gte: thisWeekStart } },
      }),
      prisma.jobApplication.count({
        where: { userId, createdAt: { gte: lastWeekStart, lt: thisWeekStart } },
      }),
      prisma.userJob.count({
        where: { userId, createdAt: { gte: thisWeekStart } },
      }),
      prisma.userJob.count({
        where: { userId, createdAt: { gte: lastWeekStart, lt: thisWeekStart } },
      }),
      prisma.jobApplication.count({ where: { userId } }),
      prisma.userSettings.findUnique({
        where: { userId },
        select: { keywords: true },
      }),
    ]);

    const totalJobs = userJobs.length;
    const saved = userJobs.filter((j) => j.stage === "SAVED").length;
    const applied = userJobs.filter((j) => j.stage !== "SAVED").length;
    const interviews = userJobs.filter((j) => j.stage === "INTERVIEW").length;
    const offers = userJobs.filter((j) => j.stage === "OFFER").length;
    const rejected = userJobs.filter((j) => j.stage === "REJECTED").length;
    const ghosted = userJobs.filter((j) => j.stage === "GHOSTED").length;
    const responseRate =
      applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

    // Weekly applications over time
    const weeklyApplications: Record<string, number> = {};
    for (const job of userJobs) {
      if (job.stage !== "SAVED" && job.createdAt) {
        const week = getWeekLabel(job.createdAt);
        weeklyApplications[week] = (weeklyApplications[week] || 0) + 1;
      }
    }
    const applicationsOverTime = Object.entries(weeklyApplications)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    const stageFunnel = [
      { stage: "Saved", count: saved + applied },
      { stage: "Applied", count: applied },
      { stage: "Interview", count: interviews + offers },
      { stage: "Offer", count: offers },
    ];

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    for (const job of userJobs) {
      const src = job.globalJob.source;
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    }
    const sourceBreakdown = Object.entries(sourceMap).map(
      ([source, count]) => ({ source: formatSource(source), count }),
    );

    // Weekly activity from grouped query
    const activityOverTime = activityWeekly
      .map((row) => ({ week: row.week, count: Number(row.count) }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    // Speed Metrics — reuse userJobs data, no extra query needed
    const sentApps = userJobs.filter(
      (j) => j.application?.status === "SENT" && j.application.sentAt,
    );
    let avgApplyMinutes = 0;
    let fastApplyCount = 0;
    const speedTimeline: { date: string; minutes: number }[] = [];

    for (const job of sentApps) {
      const sentAt = new Date(job.application!.sentAt!).getTime();
      const firstSeen = new Date(job.globalJob.firstSeenAt).getTime();
      const diffMin = Math.max(0, (sentAt - firstSeen) / 60000);
      if (diffMin < 20) fastApplyCount++;
      const dateStr = new Date(job.application!.sentAt!).toISOString().split("T")[0];
      speedTimeline.push({ date: dateStr, minutes: Math.round(diffMin) });
    }

    if (sentApps.length > 0) {
      const totalMin = speedTimeline.reduce((sum, s) => sum + s.minutes, 0);
      avgApplyMinutes = Math.round(totalMin / sentApps.length);
    }

    const instantCount = sentApps.filter(
      (j) =>
        j.application!.appliedVia === "EMAIL" &&
        new Date(j.application!.sentAt!).getTime() -
          new Date(j.globalJob.firstSeenAt).getTime() <
          20 * 60000,
    ).length;
    const autoSentCount =
      sentApps.filter((j) => j.application!.appliedVia === "EMAIL").length -
      instantCount;
    const manualCount = userJobs.filter(
      (j) => j.application?.appliedVia === "MANUAL",
    ).length;
    const platformCount = userJobs.filter(
      (j) => j.application?.appliedVia === "PLATFORM",
    ).length;
    const draftCount = userJobs.filter(
      (j) => j.application?.status === "DRAFT",
    ).length;

    const applyMethodBreakdown = [
      { method: "Instant", count: instantCount },
      { method: "Auto-sent", count: autoSentCount },
      { method: "Manual", count: manualCount },
      { method: "Platform", count: platformCount },
      { method: "Draft", count: draftCount },
    ].filter((m) => m.count > 0);

    // Speed timeline (average per day, last 14 days)
    const dailySpeed: Record<string, { total: number; count: number }> = {};
    for (const s of speedTimeline) {
      if (!dailySpeed[s.date]) dailySpeed[s.date] = { total: 0, count: 0 };
      dailySpeed[s.date].total += s.minutes;
      dailySpeed[s.date].count++;
    }
    const speedOverTime = Object.entries(dailySpeed)
      .map(([date, d]) => ({ date, avgMinutes: Math.round(d.total / d.count) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    // Match score distribution
    const scoreBuckets = [
      { range: "0-20%", min: 0, max: 20, count: 0 },
      { range: "21-40%", min: 21, max: 40, count: 0 },
      { range: "41-60%", min: 41, max: 60, count: 0 },
      { range: "61-80%", min: 61, max: 80, count: 0 },
      { range: "81-100%", min: 81, max: 100, count: 0 },
    ];
    for (const job of userJobs) {
      if (job.matchScore != null) {
        const score = Math.round(job.matchScore);
        const bucket = scoreBuckets.find((b) => score >= b.min && score <= b.max);
        if (bucket) bucket.count++;
      }
    }
    const matchScoreDistribution = scoreBuckets.map(({ range, count }) => ({ range, count }));

    // Response Rate (donut chart)
    const responseRateBreakdown = [
      { name: "Interview/Offer", value: interviews + offers },
      { name: "Rejected", value: rejected },
      { name: "Ghosted", value: ghosted },
      { name: "Awaiting", value: Math.max(0, applied - (interviews + offers) - rejected - ghosted) },
    ];

    // Top Companies — compute from already-loaded sentApps (no extra query)
    const companyCounts: Record<string, number> = {};
    for (const job of sentApps) {
      companyCounts[job.globalJob.company] = (companyCounts[job.globalJob.company] || 0) + 1;
    }
    const topCompanies = Object.entries(companyCounts)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const weeklyComparison = {
      thisWeek: { applications: thisWeekApps, matches: thisWeekMatches },
      lastWeek: { applications: lastWeekApps, matches: lastWeekMatches },
    };

    // Summary Stats
    const totalSent = sentApps.length;
    const allScores = userJobs
      .filter((j) => j.matchScore != null)
      .map((j) => j.matchScore!);
    const avgScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
        : 0;
    const responseRatePercent =
      totalSent > 0 ? Math.round(((interviews + offers) / totalSent) * 100) : 0;

    // Keyword Effectiveness — reuse the SAME userJobs already loaded (was a separate 3000-row query)
    const userKeywords = userSettings?.keywords ?? [];
    const keywordEffectiveness: { keyword: string; matches: number; saves: number; dismisses: number; applied: number }[] = [];

    if (userKeywords.length > 0) {
      for (const kw of userKeywords) {
        const kwLower = kw.toLowerCase();
        let matches = 0, saves = 0, dismisses = 0, kwApplied = 0;

        for (const uj of userJobs) {
          const titleLower = (uj.globalJob.title || "").toLowerCase();
          const skillsStr = (uj.globalJob.skills as string[] || []).join(" ").toLowerCase();
          const reasonsStr = (typeof uj.matchReasons === "string" ? uj.matchReasons : JSON.stringify(uj.matchReasons ?? "")).toLowerCase();

          if (titleLower.includes(kwLower) || skillsStr.includes(kwLower) || reasonsStr.includes(kwLower)) {
            matches++;
            if (uj.isDismissed) dismisses++;
            else if (uj.stage === "SAVED") saves++;
            else kwApplied++;
          }
        }

        keywordEffectiveness.push({ keyword: kw, matches, saves, dismisses, applied: kwApplied });
      }
      keywordEffectiveness.sort((a, b) => b.matches - a.matches);
    }

    return {
      totalJobs,
      applied,
      interviews,
      offers,
      rejected,
      ghosted,
      responseRate,
      applicationsOverTime,
      stageFunnel,
      sourceBreakdown,
      activityOverTime,
      speedMetrics: {
        avgApplyMinutes,
        fastApplyCount,
        totalSent: sentApps.length,
        instantCount,
      },
      applyMethodBreakdown,
      speedOverTime,
      matchScoreDistribution,
      responseRateBreakdown,
      topCompanies,
      weeklyComparison,
      summary: {
        totalJobs,
        totalApplications,
        totalSent,
        avgMatchScore: avgScore,
        responseRatePercent,
      },
      keywordEffectiveness,
    };
  } catch (error) {
    console.error("[getAnalytics] Error:", error);
    return EMPTY_ANALYTICS;
  }
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatSource(s: string): string {
  const map: Record<string, string> = {
    jsearch: "JSearch",
    indeed: "Indeed",
    remotive: "Remotive",
    arbeitnow: "Arbeitnow",
    adzuna: "Adzuna",
    linkedin: "LinkedIn",
    rozee: "Rozee.pk",
    google: "Google",
    manual: "Manual",
  };
  return map[s] || s;
}
