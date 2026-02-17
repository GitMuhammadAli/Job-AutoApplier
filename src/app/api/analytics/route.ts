import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "ali@demo.com" },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const jobs = await prisma.job.findMany({ where: { userId: user.id } });

    const totalJobs = jobs.length;
    const applied = jobs.filter((j) => j.stage !== "SAVED").length;
    const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
    const offers = jobs.filter((j) => j.stage === "OFFER").length;
    const rejected = jobs.filter((j) => j.stage === "REJECTED").length;
    const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
    const responseRate = applied > 0
      ? Math.round(((interviews + offers) / applied) * 100)
      : 0;

    // Applied this week
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
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
