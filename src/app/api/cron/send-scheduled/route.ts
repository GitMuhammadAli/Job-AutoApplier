import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApplication } from "@/lib/send-application";
import { LIMITS, TIMEOUTS, STUCK_SENDING_TIMEOUT_MS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes — auto-expire stale locks

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("send-scheduled");
  const startTime = Date.now();

  try {
    // Try to acquire lock — separate from send-queued (C1 fix)
    const staleCutoff = new Date(Date.now() - LOCK_TTL_MS);
    const acquired = await prisma.$queryRaw<{ name: string }[]>`
      INSERT INTO "SystemLock" ("name", "isRunning", "startedAt")
      VALUES ('send-scheduled', true, now())
      ON CONFLICT ("name") DO UPDATE SET "isRunning" = true, "startedAt" = now()
      WHERE "SystemLock"."isRunning" = false
         OR "SystemLock"."startedAt" < ${staleCutoff}
      RETURNING "name"
    `;
    if (acquired.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: "Another send-scheduled is running",
      });
    }

    // Dead letter recovery: unstick SENDING apps older than 10 min (C2 fix)
    const stuckCutoff = new Date(Date.now() - STUCK_SENDING_TIMEOUT_MS);
    const stuckRecovered = await prisma.jobApplication.updateMany({
      where: {
        status: "SENDING",
        updatedAt: { lt: stuckCutoff },
      },
      data: { status: "FAILED", errorMessage: "Stuck in SENDING state — recovered by send-scheduled" },
    });

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
        const result = await sendApplication(app.id);
        if (result.success) {
          sent++;
        } else {
          if (result.error?.includes("limit") || result.error?.includes("paused") || result.error?.includes("Wait")) {
            skipped++;
          } else {
            failed++;
          }
        }
      } catch (err) {
        failed++;
        console.error(`[SendScheduled] Error sending app ${app.id}:`, err);
      }

      const isLast = readyApps.indexOf(app) === readyApps.length - 1;
      if (!isLast) {
        await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.INTER_SEND_DELAY_MS));
      }
    }

    await prisma.systemLock.update({
      where: { name: "send-scheduled" },
      data: { isRunning: false, completedAt: new Date() },
    });

    await prisma.systemLog.create({
      data: {
        type: "send",
        source: "send-scheduled",
        message: `Processed ${readyApps.length}: ${sent} sent, ${failed} failed, ${skipped} skipped${stuckRecovered.count > 0 ? `, ${stuckRecovered.count} stuck recovered` : ""}`,
      },
    });

    await tracker.success({ processed: sent, failed, metadata: { skipped, stuckRecovered: stuckRecovered.count } });

    return NextResponse.json({
      success: true,
      total: readyApps.length,
      sent,
      failed,
      skipped,
      stuckRecovered: stuckRecovered.count,
    });
  } catch (error) {
    await prisma.systemLock
      .update({
        where: { name: "send-scheduled" },
        data: { isRunning: false, completedAt: new Date() },
      })
      .catch((lockErr) => console.error("[SendScheduled] Failed to release lock:", lockErr));

    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("SendScheduled", error, "Send scheduled failed");
  }
}
