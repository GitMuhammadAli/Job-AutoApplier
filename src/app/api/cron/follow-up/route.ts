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
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Detect ghosted: applied 14+ days ago, still in APPLIED stage
    const ghosted = await prisma.userJob.updateMany({
      where: {
        stage: "APPLIED",
        updatedAt: { lt: fourteenDaysAgo },
      },
      data: { stage: "GHOSTED" },
    });

    // Find jobs needing follow-up: applied 7+ days ago, followUpCount < 2
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
    });

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
    }

    return NextResponse.json({
      success: true,
      ghosted: ghosted.count,
      followUps: needsFollowUp.length,
    });
  } catch (error) {
    console.error("Follow-up cron error:", error);
    return NextResponse.json({ error: "Follow-up failed", details: String(error) }, { status: 500 });
  }
}
