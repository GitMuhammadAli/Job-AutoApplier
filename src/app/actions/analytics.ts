"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function getAnalytics() {
  const userId = await getAuthUserId();

  const userJobs = await prisma.userJob.findMany({
    where: { userId, isDismissed: false },
    include: {
      globalJob: { select: { source: true, postedDate: true } },
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
