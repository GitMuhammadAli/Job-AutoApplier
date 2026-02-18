import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const needsFollowUp = await prisma.userJob.findMany({
      where: {
        stage: "APPLIED",
        isDismissed: false,
        followUpCount: { lt: 2 },
        updatedAt: { lt: sevenDaysAgo },
      },
      select: { id: true, userId: true },
    });

    let processed = 0;
    for (const uj of needsFollowUp) {
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
            type: "FOLLOW_UP_SENT",
            description: "Follow-up reminder flagged",
          },
        }),
      ]);
      processed++;
    }

    return NextResponse.json({
      success: true,
      total: needsFollowUp.length,
      processed,
    });
  } catch (error) {
    console.error("Check follow-ups cron error:", error);
    return NextResponse.json(
      { error: "Check follow-ups failed", details: String(error) },
      { status: 500 }
    );
  }
}
