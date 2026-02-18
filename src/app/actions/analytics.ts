"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function getAnalytics() {
  const userId = await getAuthUserId();

  const jobs = await prisma.job.findMany({
    where: { userId },
    include: { resumeUsed: true },
  });

  const activities = await prisma.activity.findMany({
    where: { job: { userId } },
    orderBy: { createdAt: "asc" },
  });

  const totalJobs = jobs.length;
  const saved = jobs.filter((j) => j.stage === "SAVED").length;
  const applied = jobs.filter((j) => j.stage !== "SAVED").length;
  const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
  const offers = jobs.filter((j) => j.stage === "OFFER").length;
  const rejected = jobs.filter((j) => j.stage === "REJECTED").length;
  const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
  const responseRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

  const weeklyApplications: Record<string, number> = {};
  for (const job of jobs) {
    if (job.appliedDate) {
      const week = getWeekLabel(job.appliedDate);
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

  const platformMap: Record<string, number> = {};
  for (const job of jobs) {
    platformMap[job.platform] = (platformMap[job.platform] || 0) + 1;
  }
  const platformBreakdown = Object.entries(platformMap).map(([platform, count]) => ({
    platform: formatPlatform(platform),
    count,
  }));

  const resumeMap: Record<string, { name: string; total: number; responded: number }> = {};
  for (const job of jobs) {
    const rName = job.resumeUsed?.name ?? "No Resume";
    if (!resumeMap[rName]) resumeMap[rName] = { name: rName, total: 0, responded: 0 };
    if (job.stage !== "SAVED") {
      resumeMap[rName].total++;
      if (["INTERVIEW", "OFFER"].includes(job.stage)) {
        resumeMap[rName].responded++;
      }
    }
  }
  const resumePerformance = Object.values(resumeMap)
    .filter((r) => r.total > 0)
    .map((r) => ({
      name: r.name,
      total: r.total,
      responseRate: Math.round((r.responded / r.total) * 100),
    }));

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
    platformBreakdown,
    resumePerformance,
    activityOverTime,
  };
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatPlatform(p: string): string {
  const map: Record<string, string> = {
    LINKEDIN: "LinkedIn",
    INDEED: "Indeed",
    GLASSDOOR: "Glassdoor",
    ROZEE_PK: "Rozee.pk",
    BAYT: "Bayt",
    COMPANY_SITE: "Company",
    REFERRAL: "Referral",
    OTHER: "Other",
  };
  return map[p] || p;
}
