/**
 * GET /api/admin/cost
 *
 * Super-admin AI dollar-spend dashboard. Aggregates LlmCallLog.costUsd over
 * the last 24h / 7d / 30d windows and breaks it down by:
 *   - provider (groq, gemini)
 *   - model (llama-3.3-70b-versatile, etc)
 *   - route (which agent call site)
 *   - user (top N spenders)
 *
 * The cost column was added in 20260614180000_add_llm_cost — every
 * recordUsage() write since then includes the dollar figure derived from
 * src/lib/cost/pricing.ts (PROVIDER_PRICING table).
 *
 * Also surfaces *alerts*: if any (provider, day) row exceeds a configurable
 * threshold (default $1/day per provider), an alert object lands in the
 * response so the UI can highlight it in red.
 *
 * No rate limit beyond the global middleware — this is admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN } from "@/lib/messages";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

const ALERT_THRESHOLDS: Record<string, number> = {
  // Per-provider daily $ alert. Tuned conservatively — $1/day on Groq is
  // ~10k generate runs at current pricing; on Gemini it's ~2k. Once a real
  // cost baseline exists, raise these via env override.
  groq: 1.0,
  gemini: 1.0,
};

function parseThreshold(provider: string): number {
  const env = process.env[`COST_ALERT_${provider.toUpperCase()}_USD`];
  if (env) {
    const n = parseFloat(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return ALERT_THRESHOLDS[provider] ?? 5.0;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }

    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Tight scoping: only "ok" rows count toward spend; rejected/error
    // rows still get summed in their own counters so the UI can flag a
    // high failure rate distinct from high $ burn.
    const [byProviderDay, byProviderWeek, byProviderMonth, byModel30d, byRoute7d, byUser7d, byDay30d, errorRows30d] =
      await Promise.all([
        prisma.llmCallLog.groupBy({
          by: ["provider"],
          where: { status: "ok", createdAt: { gte: day } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
          _count: { _all: true },
        }),
        prisma.llmCallLog.groupBy({
          by: ["provider"],
          where: { status: "ok", createdAt: { gte: week } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
          _count: { _all: true },
        }),
        prisma.llmCallLog.groupBy({
          by: ["provider"],
          where: { status: "ok", createdAt: { gte: month } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
          _count: { _all: true },
        }),
        prisma.llmCallLog.groupBy({
          by: ["provider", "model"],
          where: { status: "ok", createdAt: { gte: month } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
          _count: { _all: true },
          orderBy: { _sum: { costUsd: "desc" } },
          take: 20,
        }),
        prisma.llmCallLog.groupBy({
          by: ["route"],
          where: { status: "ok", createdAt: { gte: week } },
          _sum: { costUsd: true },
          _count: { _all: true },
          orderBy: { _sum: { costUsd: "desc" } },
          take: 15,
        }),
        prisma.llmCallLog.groupBy({
          by: ["userId"],
          where: { status: "ok", createdAt: { gte: week } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
          _count: { _all: true },
          orderBy: { _sum: { costUsd: "desc" } },
          take: 25,
        }),
        // Daily spend over the last 30d — raw rows; bucketing happens in JS.
        // groupBy on date_trunc would need raw SQL on Postgres; the row
        // volume here is bounded by call rate * 30 so JS bucketing is fine.
        prisma.llmCallLog.findMany({
          where: { status: "ok", createdAt: { gte: month } },
          select: { provider: true, costUsd: true, createdAt: true },
        }),
        prisma.llmCallLog.groupBy({
          by: ["provider", "status"],
          where: { status: { in: ["error", "rejected_quota", "rejected_global"] }, createdAt: { gte: month } },
          _count: { _all: true },
        }),
      ]);

    // Hydrate user emails for the top spenders.
    const userIds = byUser7d.map((u) => u.userId);
    const userRows = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    // Daily buckets — Map<provider, Map<YYYY-MM-DD, $>>
    const dailyBuckets = new Map<string, Map<string, number>>();
    for (const r of byDay30d) {
      if (!r.costUsd) continue;
      const isoDay = r.createdAt.toISOString().slice(0, 10);
      if (!dailyBuckets.has(r.provider)) dailyBuckets.set(r.provider, new Map());
      const m = dailyBuckets.get(r.provider)!;
      m.set(isoDay, (m.get(isoDay) ?? 0) + r.costUsd);
    }
    const byDay: Array<{ provider: string; day: string; usd: number }> = [];
    dailyBuckets.forEach((m, provider) => {
      m.forEach((usd, day) => {
        byDay.push({ provider, day, usd: Math.round(usd * 10000) / 10000 });
      });
    });
    byDay.sort((a, b) => (a.day < b.day ? 1 : -1));

    // Threshold alerts — fired when ANY (provider, day) hit the cap.
    const alerts: Array<{ provider: string; day: string; usd: number; threshold: number }> = [];
    for (const row of byDay) {
      const t = parseThreshold(row.provider);
      if (row.usd >= t) alerts.push({ ...row, threshold: t });
    }

    return NextResponse.json({
      windows: {
        last24h: byProviderDay.map(formatProviderRow),
        last7d: byProviderWeek.map(formatProviderRow),
        last30d: byProviderMonth.map(formatProviderRow),
      },
      byModel: byModel30d.map(formatProviderRow),
      byRoute: byRoute7d.map((r) => ({
        route: r.route,
        usd: round(r._sum.costUsd ?? 0),
        calls: r._count._all,
      })),
      topUsers: byUser7d.map((r) => {
        const u = userMap.get(r.userId);
        return {
          userId: r.userId,
          email: u?.email ?? null,
          name: u?.name ?? null,
          usd: round(r._sum.costUsd ?? 0),
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
          calls: r._count._all,
        };
      }),
      byDay,
      errorCounts: errorRows30d.map((r) => ({
        provider: r.provider,
        status: r.status,
        count: r._count._all,
      })),
      alerts,
      thresholds: ALERT_THRESHOLDS,
    });
  } catch (error) {
    await captureError(error, { route: "/api/admin/cost" });
    return NextResponse.json({ error: "Cost rollup failed" }, { status: 500 });
  }
}

function formatProviderRow(r: {
  provider: string;
  model?: string;
  _sum: { costUsd: number | null; inputTokens: number | null; outputTokens: number | null };
  _count: { _all: number };
}) {
  return {
    provider: r.provider,
    model: r.model,
    usd: round(r._sum.costUsd ?? 0),
    inputTokens: r._sum.inputTokens ?? 0,
    outputTokens: r._sum.outputTokens ?? 0,
    calls: r._count._all,
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
