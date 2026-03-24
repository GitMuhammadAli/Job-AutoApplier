import { prisma } from "@/lib/prisma";

interface SendTimeRecommendation {
  bestDay: string;
  bestHour: number;
  reason: string;
  heatmap: Array<{ day: string; hour: number; score: number }>;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getBestSendTime(userId: string): Promise<SendTimeRecommendation> {
  const applications = await prisma.userJob.findMany({
    where: { userId, stage: { in: ["APPLIED", "INTERVIEW", "OFFER"] } },
    select: { createdAt: true, stage: true },
  });

  if (applications.length < 5) {
    return {
      bestDay: "Tuesday",
      bestHour: 10,
      reason: "Industry data shows Tuesday 9-11 AM has highest open rates. Send more applications to get personalized recommendations.",
      heatmap: generateDefaultHeatmap(),
    };
  }

  const heatmap: Record<string, Record<number, { total: number; success: number }>> = {};

  for (const app of applications) {
    const day = DAYS[app.createdAt.getDay()];
    const hour = app.createdAt.getHours();
    const isSuccess = app.stage === "INTERVIEW" || app.stage === "OFFER";
    if (!heatmap[day]) heatmap[day] = {};
    if (!heatmap[day][hour]) heatmap[day][hour] = { total: 0, success: 0 };
    heatmap[day][hour].total++;
    if (isSuccess) heatmap[day][hour].success++;
  }

  let bestScore = -1;
  let bestDay = "Tuesday";
  let bestHour = 10;
  const heatmapArr: Array<{ day: string; hour: number; score: number }> = [];

  for (const day of DAYS) {
    for (let hour = 7; hour <= 20; hour++) {
      const slot = heatmap[day]?.[hour];
      const score = slot ? (slot.success / Math.max(slot.total, 1)) * 100 : 0;
      heatmapArr.push({ day, hour, score });
      if (score > bestScore) { bestScore = score; bestDay = day; bestHour = hour; }
    }
  }

  return {
    bestDay,
    bestHour,
    reason: `Based on your ${applications.length} applications, ${bestDay} at ${bestHour}:00 has the highest response rate.`,
    heatmap: heatmapArr,
  };
}

function generateDefaultHeatmap() {
  const defaults: Array<{ day: string; hour: number; score: number }> = [];
  for (const day of DAYS) {
    for (let hour = 7; hour <= 20; hour++) {
      let score = 30;
      if (["Tuesday", "Wednesday", "Thursday"].includes(day)) score += 20;
      if (hour >= 9 && hour <= 11) score += 30;
      else if (hour >= 14 && hour <= 16) score += 15;
      if (day === "Saturday" || day === "Sunday") score = 10;
      defaults.push({ day, hour, score });
    }
  }
  return defaults;
}
