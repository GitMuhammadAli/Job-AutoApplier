import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFollowUpReminder } from "@/lib/email";

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

    const followUpDays = user.settings?.followUpDays ?? 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - followUpDays);

    const staleJobs = await prisma.job.findMany({
      where: {
        userId: user.id,
        stage: "APPLIED",
        appliedDate: { lte: cutoffDate },
      },
    });

    if (staleJobs.length === 0) {
      return NextResponse.json({ message: "No follow-ups needed" });
    }

    const followUpData = staleJobs.map((j) => ({
      company: j.company,
      role: j.role,
      daysAgo: Math.floor((Date.now() - (j.appliedDate?.getTime() ?? Date.now())) / 86400000),
      url: j.url,
    }));

    if (user.settings?.emailNotifications !== false) {
      await sendFollowUpReminder(followUpData);
    }

    return NextResponse.json({
      message: `${staleJobs.length} follow-ups sent`,
      count: staleJobs.length,
    });
  } catch (err: any) {
    console.error("Follow-up cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
