import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGhostAlert } from "@/lib/email";

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
      const ghostDays = user.settings?.ghostDays ?? 14;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ghostDays);

      const ghostedJobs = await prisma.job.findMany({
        where: { userId: user.id, stage: "APPLIED", appliedDate: { lte: cutoffDate }, isGhosted: false },
      });

      for (const job of ghostedJobs) {
        await prisma.$transaction([
          prisma.job.update({ where: { id: job.id }, data: { stage: "GHOSTED", isGhosted: true } }),
          prisma.activity.create({
            data: {
              jobId: job.id, type: "ghost_detected", fromStage: "APPLIED", toStage: "GHOSTED",
              note: `Auto-marked as ghosted after ${ghostDays} days`, metadata: { automated: true },
            },
          }),
        ]);
      }

      if (ghostedJobs.length > 0 && user.settings?.emailNotifications !== false && user.email) {
        const ghostData = ghostedJobs.map((j) => ({
          company: j.company, role: j.role,
          daysAgo: Math.floor((Date.now() - (j.appliedDate?.getTime() ?? Date.now())) / 86400000),
        }));
        await sendGhostAlert(ghostData, user.email);
        totalCount += ghostedJobs.length;
      }
    }

    return NextResponse.json({ message: `${totalCount} jobs ghosted across ${users.length} users` });
  } catch (err: any) {
    console.error("Ghost detect cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
