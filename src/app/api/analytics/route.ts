import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const jobs = await prisma.job.findMany({ where: { userId } });

    const totalJobs = jobs.length;
    const applied = jobs.filter((j) => j.stage !== "SAVED").length;
    const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
    const offers = jobs.filter((j) => j.stage === "OFFER").length;
    const rejected = jobs.filter((j) => j.stage === "REJECTED").length;
    const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
    const responseRate = applied > 0
      ? Math.round(((interviews + offers) / applied) * 100)
      : 0;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const appliedThisWeek = jobs.filter(
      (j) => j.appliedDate && j.appliedDate >= weekAgo
    ).length;

    return NextResponse.json({
      totalJobs,
      applied,
      interviews,
      offers,
      rejected,
      ghosted,
      responseRate,
      appliedThisWeek,
    });
  } catch (err: any) {
    if (err.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
