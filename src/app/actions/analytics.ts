"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function getAnalytics() {
  const userId = await getAuthUserId();

  const userJobs = await prisma.userJob.findMany({
    where: { userId, isDismissed: false },
    include: {
      globalJob: { select: { source: true, postedDate: true, firstSeenAt: true } },
      application: { select: { status: true, sentAt: true, appliedVia: true } },
    },
  });

  const activities = await prisma.activity.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const totalJobs = userJobs.length;
  const saved = userJobs.filter((j) => j.stage === "SAVED").length;
  const applied = userJobs.filter((j) => j.stage !== "SAVED").length;
  const interviews = userJobs.filter((j) => j.stage === "INTERVIEW").length;
  const offers = userJobs.filter((j) => j.stage === "OFFER").length;
  const rejected = userJobs.filter((j) => j.stage === "REJECTED").length;
  const ghosted = userJobs.filter((j) => j.stage === "GHOSTED").length;
  const responseRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

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
  const sourceBreakdown = Object.entries(sourceMap).map(([source, count]) => ({
    source: formatSource(source),
    count,
  }));

  // Weekly activity
  const weeklyActivity: Record<string, number> = {};
  for (const a of activities) {
    const week = getWeekLabel(a.createdAt);
    weeklyActivity[week] = (weeklyActivity[week] || 0) + 1;
  }
  const activityOverTime = Object.entries(weeklyActivity)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);

  // ── Speed Metrics ──
  const sentApps = userJobs.filter((j) => j.application?.status === "SENT" && j.application.sentAt);
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

  // Instant vs manual vs draft breakdown
  const instantCount = sentApps.filter((j) =>
    j.application!.appliedVia === "EMAIL" &&
    (new Date(j.application!.sentAt!).getTime() - new Date(j.globalJob.firstSeenAt).getTime()) < 20 * 60000
  ).length;
  const autoSentCount = sentApps.filter((j) => j.application!.appliedVia === "EMAIL").length - instantCount;
  const manualCount = userJobs.filter((j) => j.application?.appliedVia === "MANUAL").length;
  const platformCount = userJobs.filter((j) => j.application?.appliedVia === "PLATFORM").length;
  const draftCount = userJobs.filter((j) => j.application?.status === "DRAFT").length;

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
  };
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
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
