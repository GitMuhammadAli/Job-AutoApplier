import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWeeklyDigest } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: "ali@demo.com" },
      include: { settings: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const jobs = await prisma.job.findMany({ where: { userId: user.id } });

    // Applied this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const appliedThisWeek = jobs.filter(
      (j) => j.appliedDate && j.appliedDate >= weekAgo
    ).length;

    const totalJobs = jobs.length;
    const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
    const offers = jobs.filter((j) => j.stage === "OFFER").length;
    const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
    const applied = jobs.filter((j) => j.stage !== "SAVED").length;
    const responseRate = applied > 0
      ? Math.round(((interviews + offers) / applied) * 100)
      : 0;

    const stats = {
      totalJobs,
      appliedThisWeek,
      interviews,
      offers,
      ghosted,
      responseRate,
    };

    if (user.settings?.emailNotifications !== false) {
      await sendWeeklyDigest(stats);
    }

    return NextResponse.json({ message: "Weekly digest sent", stats });
  } catch (err: any) {
    console.error("Weekly digest cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
