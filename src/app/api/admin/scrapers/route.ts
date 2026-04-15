import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN, GENERIC } from "@/lib/messages";

export const dynamic = "force-dynamic";

const SOURCES = [
  "indeed",
  "remotive",
  "arbeitnow",
  "linkedin",
  "linkedin_posts",
  "rozee",
  "jsearch",
  "adzuna",
  "google",
];

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const health = await Promise.all(
      SOURCES.map(async (source) => {
        const [lastLog, jobs, errCount, recentLogs] = await Promise.all([
          prisma.systemLog.findFirst({
            where: { type: "scrape-detail", source },
            orderBy: { createdAt: "desc" },
          }),
          prisma.globalJob.count({ where: { source } }),
          prisma.systemLog.count({
            where: { type: "error", source, createdAt: { gte: dayAgo } },
          }),
          prisma.systemLog.findMany({
            where: { source, type: "scrape-detail" },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { message: true, metadata: true, createdAt: true },
          }),
        ]);
        return {
          source,
          lastRun: lastLog?.createdAt ?? null,
          totalJobs: jobs,
          errorsLast24h: errCount,
          metadata: lastLog?.metadata ?? null,
          recentLogs,
        };
      }),
    );

    return NextResponse.json(health, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[admin/scrapers]", error);
    return NextResponse.json({ error: GENERIC.INTERNAL_ERROR }, { status: 500 });
  }
}
