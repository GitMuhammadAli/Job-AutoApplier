import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApplication } from "@/lib/send-application";
import { canSendNow } from "@/lib/send-limiter";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lock = await prisma.systemLock.findUnique({ where: { name: "send-applications" } });
    if (lock?.isRunning) {
      return NextResponse.json({ skipped: true, reason: "Another send cron is running" });
    }

    await prisma.systemLock.upsert({
      where: { name: "send-applications" },
      update: { isRunning: true, startedAt: new Date() },
      create: { name: "send-applications", isRunning: true, startedAt: new Date() },
    });

    const readyApps = await prisma.jobApplication.findMany({
      where: {
        status: "READY",
        scheduledSendAt: { not: null, lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const app of readyApps) {
      const limitCheck = await canSendNow(app.userId);
      if (!limitCheck.allowed) {
        skipped++;
        continue;
      }

      const result = await sendApplication(app.id);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await prisma.systemLock.update({
      where: { name: "send-applications" },
      data: { isRunning: false, completedAt: new Date() },
    });

    await prisma.systemLog.create({
      data: {
        type: "send",
        source: "send-scheduled",
        message: `Processed ${readyApps.length}: ${sent} sent, ${failed} failed, ${skipped} skipped (limit)`,
      },
    });

    return NextResponse.json({
      total: readyApps.length,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    await prisma.systemLock.update({
      where: { name: "send-applications" },
      data: { isRunning: false, completedAt: new Date() },
    }).catch(() => {});

    console.error("[SendScheduled] Error:", error);
    return NextResponse.json(
      { error: "Send scheduled failed", details: String(error) },
      { status: 500 }
    );
  }
}
