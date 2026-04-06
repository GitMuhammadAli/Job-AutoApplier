import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  CRON_REGISTRY,
  TRIGGERABLE_CRON_KEYS,
  getApproxIntervalMs,
  getNextRunAt,
} from "@/lib/cron-registry";

export const dynamic = "force-dynamic";

export type CronStatusRow = {
  key: string;
  label: string;
  category: string;
  schedule: string;
  scheduleLabel: string;
  lastRunAt: string | null;
  lastStatus: "success" | "error" | "skipped" | null;
  lastDurationMs: number | null;
  lastProcessed: number | null;
  lastFailed: number | null;
  nextRunAt: string;
  intervalMs: number;
  triggerable: boolean;
};

export type CronStatusResponse = {
  crons: CronStatusRow[];
  isAdmin: boolean;
  generatedAt: string;
};

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const keys = CRON_REGISTRY.map((c) => c.key);

    // One query for the latest N cron-run logs across all registered crons,
    // then dedupe in JS to take the newest per source — avoids N+1.
    const logs = await prisma.systemLog.findMany({
      where: {
        type: "cron-run",
        source: { in: keys },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        source: true,
        metadata: true,
        createdAt: true,
      },
    });

    const latestBySource = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (!log.source) continue;
      if (!latestBySource.has(log.source)) {
        latestBySource.set(log.source, log);
      }
    }

    const now = new Date();
    const crons: CronStatusRow[] = CRON_REGISTRY.map((cron) => {
      const latest = latestBySource.get(cron.key);
      const meta = (latest?.metadata ?? {}) as Record<string, unknown>;
      const rawStatus = meta.status as string | undefined;
      const lastStatus: CronStatusRow["lastStatus"] =
        rawStatus === "success" ||
        rawStatus === "error" ||
        rawStatus === "skipped"
          ? rawStatus
          : null;

      const nextRunAt = getNextRunAt(cron.schedule, now);
      const intervalMs = getApproxIntervalMs(cron.schedule);

      return {
        key: cron.key,
        label: cron.label,
        category: cron.category,
        schedule: cron.schedule,
        scheduleLabel: cron.scheduleLabel,
        lastRunAt: latest?.createdAt
          ? new Date(latest.createdAt).toISOString()
          : null,
        lastStatus,
        lastDurationMs:
          typeof meta.durationMs === "number" ? meta.durationMs : null,
        lastProcessed:
          typeof meta.processed === "number" ? meta.processed : null,
        lastFailed: typeof meta.failed === "number" ? meta.failed : null,
        nextRunAt: nextRunAt.toISOString(),
        intervalMs,
        triggerable: TRIGGERABLE_CRON_KEYS.has(cron.key),
      };
    });

    const response = NextResponse.json<CronStatusResponse>({
      crons,
      isAdmin: isAdmin(session.user.email),
      generatedAt: now.toISOString(),
    });
    response.headers.set(
      "Cache-Control",
      "private, max-age=15, stale-while-revalidate=30",
    );
    return response;
  } catch (error) {
    console.error("[cron-status] error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
