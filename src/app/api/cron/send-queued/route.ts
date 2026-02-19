import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApplication } from "@/lib/send-application";
import { canSendNow } from "@/lib/send-limiter";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

/** Legacy alias — send-scheduled is the preferred endpoint */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const readyApps = await prisma.jobApplication.findMany({
      where: {
        status: "READY",
        OR: [
          { scheduledSendAt: { lte: new Date() } },
          { scheduledSendAt: null },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 20,
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

    await prisma.systemLog.create({
      data: {
        type: "send",
        source: "send-queued",
        message: `Processed ${readyApps.length}: ${sent} sent, ${failed} failed, ${skipped} skipped`,
      },
    });

    return NextResponse.json({
      success: true,
      processed: readyApps.length,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("Send queued error:", error);
    return NextResponse.json(
      { error: "Send failed", details: String(error) },
      { status: 500 }
    );
  }
}
