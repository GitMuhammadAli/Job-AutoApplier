import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApplication } from "@/lib/send-application";
import { canSendNow } from "@/lib/send-limiter";
import { LIMITS, TIMEOUTS } from "@/lib/constants";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false;
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const acquired = await prisma.$queryRaw<{ name: string }[]>`
      INSERT INTO "SystemLock" ("name", "isRunning", "startedAt")
      VALUES ('send-applications', true, now())
      ON CONFLICT ("name") DO UPDATE SET "isRunning" = true, "startedAt" = now()
      WHERE "SystemLock"."isRunning" = false
      RETURNING "name"
    `;
    if (acquired.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: "Another send cron is running",
      });
    }

    const readyApps = await prisma.jobApplication.findMany({
      where: {
        status: "READY",
        scheduledSendAt: { not: null, lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
      take: LIMITS.SEND_SCHEDULED_BATCH,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const app of readyApps) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      try {
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
      } catch (err) {
        failed++;
        console.error(`[SendScheduled] Error sending app ${app.id}:`, err);
      }

      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.INTER_SEND_DELAY_MS));
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
      success: true,
      total: readyApps.length,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    await prisma.systemLock
      .update({
        where: { name: "send-applications" },
        data: { isRunning: false, completedAt: new Date() },
      })
      .catch(() => {});

    console.error("[SendScheduled] Error:", error);
    return NextResponse.json(
      { error: "Send scheduled failed", details: String(error) },
      { status: 500 },
    );
  }
}
