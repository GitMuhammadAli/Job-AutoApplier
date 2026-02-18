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
    const users = await prisma.user.findMany({
      where: { settings: { isNot: null } },
      include: { settings: true },
    });

    let totalCount = 0;
    for (const user of users) {
      const followUpDays = user.settings?.followUpDays ?? 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - followUpDays);

      const staleJobs = await prisma.job.findMany({
        where: { userId: user.id, stage: "APPLIED", appliedDate: { lte: cutoffDate } },
      });

      if (staleJobs.length > 0 && user.settings?.emailNotifications !== false && user.email) {
        const data = staleJobs.map((j) => ({
          company: j.company,
          role: j.role,
          daysAgo: Math.floor((Date.now() - (j.appliedDate?.getTime() ?? Date.now())) / 86400000),
          url: j.url,
        }));
        await sendFollowUpReminder(data, user.email);
        totalCount += staleJobs.length;
      }
    }

    return NextResponse.json({ message: `${totalCount} follow-ups sent across ${users.length} users` });
  } catch (err: any) {
    console.error("Follow-up cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
