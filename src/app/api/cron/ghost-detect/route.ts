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
    const user = await prisma.user.findUnique({
      where: { email: "ali@demo.com" },
      include: { settings: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ghostDays = user.settings?.ghostDays ?? 14;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ghostDays);

    const ghostedJobs = await prisma.job.findMany({
      where: {
        userId: user.id,
        stage: "APPLIED",
        appliedDate: { lte: cutoffDate },
        isGhosted: false,
      },
    });

    if (ghostedJobs.length === 0) {
      return NextResponse.json({ message: "No ghosts detected" });
    }

    // Update jobs to GHOSTED
    for (const job of ghostedJobs) {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: { stage: "GHOSTED", isGhosted: true },
        }),
        prisma.activity.create({
          data: {
            jobId: job.id,
            type: "ghost_detected",
            fromStage: "APPLIED",
            toStage: "GHOSTED",
            note: `Auto-marked as ghosted after ${ghostDays} days`,
            metadata: { automated: true },
          },
        }),
      ]);
    }

    const ghostData = ghostedJobs.map((j) => ({
      company: j.company,
      role: j.role,
      daysAgo: Math.floor((Date.now() - (j.appliedDate?.getTime() ?? Date.now())) / 86400000),
    }));

    if (user.settings?.emailNotifications !== false) {
      await sendGhostAlert(ghostData);
    }

    return NextResponse.json({
      message: `${ghostedJobs.length} jobs marked as ghosted`,
      count: ghostedJobs.length,
    });
  } catch (err: any) {
    console.error("Ghost detect cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
