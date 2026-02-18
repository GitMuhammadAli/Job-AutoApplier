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
    const users = await prisma.user.findMany({
      where: { settings: { emailNotifications: true } },
      include: { settings: true },
    });

    let sentCount = 0;
    for (const user of users) {
      if (!user.email) continue;

      const jobs = await prisma.job.findMany({ where: { userId: user.id } });
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const appliedThisWeek = jobs.filter((j) => j.appliedDate && j.appliedDate >= weekAgo).length;
      const totalJobs = jobs.length;
      const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
      const offers = jobs.filter((j) => j.stage === "OFFER").length;
      const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
      const applied = jobs.filter((j) => j.stage !== "SAVED").length;
      const responseRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

      await sendWeeklyDigest({ totalJobs, appliedThisWeek, interviews, offers, ghosted, responseRate }, user.email);
      sentCount++;
    }

    return NextResponse.json({ message: `Weekly digest sent to ${sentCount} users` });
  } catch (err: any) {
    console.error("Weekly digest cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
