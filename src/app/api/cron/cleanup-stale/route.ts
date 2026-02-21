import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_DAYS, STUCK_SENDING_TIMEOUT_MS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  try {
    const now = new Date();
    let totalMarkedInactive = 0;
    const perSource: Record<string, number> = {};

    // Per-source stale detection
    for (const [source, days] of Object.entries(STALE_DAYS)) {
      if (source === "default") continue;

      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.globalJob.updateMany({
        where: {
          source,
          lastSeenAt: { lt: cutoff },
          isActive: true,
        },
        data: { isActive: false },
      });

      if (result.count > 0) {
        perSource[source] = result.count;
        totalMarkedInactive += result.count;
      }
    }

    // Default for any source not explicitly configured
    const defaultCutoff = new Date(now.getTime() - (STALE_DAYS.default ?? 7) * 24 * 60 * 60 * 1000);
    const configuredSources = Object.keys(STALE_DAYS).filter(s => s !== "default");
    const defaultResult = await prisma.globalJob.updateMany({
      where: {
        source: { notIn: configuredSources },
        lastSeenAt: { lt: defaultCutoff },
        isActive: true,
      },
      data: { isActive: false },
    });
    if (defaultResult.count > 0) {
      perSource["other"] = defaultResult.count;
      totalMarkedInactive += defaultResult.count;
    }

    // Dead letter recovery: unstick SENDING apps older than 10 min
    const stuckCutoff = new Date(Date.now() - STUCK_SENDING_TIMEOUT_MS);
    const stuckRecovered = await prisma.jobApplication.updateMany({
      where: {
        status: "SENDING",
        updatedAt: { lt: stuckCutoff },
      },
      data: { status: "FAILED", errorMessage: "Stuck in SENDING state — recovered by cleanup cron" },
    });

    // Prune old SystemLog entries (keep last 30 days)
    const logCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prunedLogs = await prisma.systemLog.deleteMany({
      where: { createdAt: { lt: logCutoff } },
    });

    await prisma.systemLog.create({
      data: {
        type: "cron",
        source: "cleanup-stale",
        message: `Marked ${totalMarkedInactive} stale jobs inactive, recovered ${stuckRecovered.count} stuck sends, pruned ${prunedLogs.count} old logs`,
        metadata: { markedInactive: totalMarkedInactive, perSource, stuckRecovered: stuckRecovered.count, prunedLogs: prunedLogs.count },
      },
    });

    return NextResponse.json({
      success: true,
      markedInactive: totalMarkedInactive,
      perSource,
      stuckRecovered: stuckRecovered.count,
    });
  } catch (error) {
    console.error("[CleanupStale] Error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 },
    );
  }
}
