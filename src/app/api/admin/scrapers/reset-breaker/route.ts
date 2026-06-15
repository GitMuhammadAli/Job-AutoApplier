/**
 * POST /api/admin/scrapers/reset-breaker
 *
 * Manually reset a stuck scraper circuit breaker. The breaker in
 * `src/lib/scrapers/scraper-runner.ts` opens after 3 consecutive failures
 * in the last 5 runs and stays open for 6h. When the underlying provider
 * recovers earlier (you fixed the API key, quota refilled, etc.) you'd
 * normally have to wait the full cooldown.
 *
 * This route writes a synthetic "success" ScraperRun row for the source,
 * which immediately drops `recentFails.every((r) => failed)` to false →
 * breaker closes on the next isCircuitOpen check.
 *
 * Body: { source: string }
 *   source must match the value stored on ScraperRun rows (e.g. "rozee",
 *   "google", "jsearch", "adzuna", "indeed", "linkedin_posts").
 *
 * Returns the new run id + the prior failure-streak that was masked.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ADMIN } from "@/lib/messages";
import { parseBody } from "@/lib/validation/parse-body";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

const Body = z.object({
  source: z.string().trim().min(1).max(64),
});

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }
    const parsed = await parseBody(req, Body);
    if (!parsed.ok) return parsed.response;
    const { source } = parsed.data;

    const recent = await prisma.scraperRun.findMany({
      where: { source },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: { status: true, errorMessage: true, startedAt: true },
    });

    if (recent.length === 0) {
      return NextResponse.json(
        { error: `No runs exist for source "${source}" — nothing to reset.` },
        { status: 404 },
      );
    }

    const failuresInWindow = recent.filter((r) => r.status === "failed" || r.status === "timeout").length;
    const now = new Date();
    const reset = await prisma.scraperRun.create({
      data: {
        source,
        status: "success",
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        jobsFound: 0,
        errorMessage: "manual breaker reset — synthetic success row",
      },
    });

    return NextResponse.json({
      ok: true,
      source,
      resetRunId: reset.id,
      failuresInWindowBeforeReset: failuresInWindow,
      lastErrorBeforeReset: recent[0]?.errorMessage ?? null,
      note:
        "The breaker will close on next isCircuitOpen check. The next scheduled scrape (or manual trigger) will exercise the upstream API for real.",
    });
  } catch (error) {
    await captureError(error, { route: "/api/admin/scrapers/reset-breaker" });
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
