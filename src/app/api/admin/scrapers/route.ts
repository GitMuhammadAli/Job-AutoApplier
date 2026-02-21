import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCES = [
  "indeed",
  "remotive",
  "arbeitnow",
  "linkedin",
  "rozee",
  "jsearch",
  "adzuna",
  "serpapi",
];

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const health = await Promise.all(
      SOURCES.map(async (source) => {
        const [lastLog, jobs, errCount] = await Promise.all([
          prisma.systemLog.findFirst({
            where: { type: "scrape", source },
            orderBy: { createdAt: "desc" },
          }),
          prisma.globalJob.count({ where: { source } }),
          prisma.systemLog.count({
            where: { type: "error", source, createdAt: { gte: dayAgo } },
          }),
        ]);
        return {
          source,
          lastRun: lastLog?.createdAt ?? null,
          totalJobs: jobs,
          errorsLast24h: errCount,
          metadata: lastLog?.metadata ?? null,
        };
      }),
    );

    return NextResponse.json(health);
  } catch (error) {
    console.error("[admin/scrapers]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
