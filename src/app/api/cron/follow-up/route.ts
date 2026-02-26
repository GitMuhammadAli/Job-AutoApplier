import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIMITS, TIMEOUTS } from "@/lib/constants";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const ghosted = await prisma.userJob.updateMany({
      where: {
        stage: "APPLIED",
        updatedAt: { lt: fourteenDaysAgo },
      },
      data: { stage: "GHOSTED" },
    });

    const needsFollowUp = await prisma.userJob.findMany({
      where: {
        stage: "APPLIED",
        followUpCount: { lt: 2 },
        updatedAt: { lt: sevenDaysAgo },
        OR: [
          { lastFollowUpAt: null },
          { lastFollowUpAt: { lt: sevenDaysAgo } },
        ],
      },
      select: { id: true, userId: true },
      take: LIMITS.FOLLOW_UP_BATCH,
    });

    let processed = 0;
    for (const uj of needsFollowUp) {
      if (Date.now() - startTime > TIMEOUTS.CRON_SOFT_LIMIT_MS) break;

      try {
        await prisma.$transaction([
          prisma.userJob.update({
            where: { id: uj.id },
            data: {
              followUpCount: { increment: 1 },
              lastFollowUpAt: new Date(),
            },
          }),
          prisma.activity.create({
            data: {
              userJobId: uj.id,
              userId: uj.userId,
              type: "FOLLOW_UP_FLAGGED",
              description: "Follow-up reminder flagged",
            },
          }),
        ]);
        processed++;
      } catch (err) {
        console.error(`[FollowUp] Error for job ${uj.id}:`, err);
      }
    }

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "follow-up",
        message: `Marked ${ghosted.count} ghosted, flagged ${processed} follow-ups`,
        metadata: { ghosted: ghosted.count, followUps: processed },
      },
    });

    return NextResponse.json({
      success: true,
      ghosted: ghosted.count,
      followUps: processed,
    });
  } catch (error) {
    return handleRouteError("FollowUp", error, "Follow-up failed");
  }
}
