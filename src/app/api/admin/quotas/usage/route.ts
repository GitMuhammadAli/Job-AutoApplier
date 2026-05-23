/**
 * GET /api/admin/quotas/usage
 *
 * Aggregated quota view for /admin/quotas. Returns:
 *   - per-provider: globalUsed, dailyBudget, activeUsers, rejected rate (last hour)
 *   - per-user table: usage, fair share, soft cap, last activity, hourly rate
 *   - per-route: top 10 by spend (across providers)
 *   - hourly trend: last 24h tokens, grouped per provider
 *
 * Cached server-side for 30s to keep the dashboard cheap.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const DEFAULT_BUDGETS: Record<string, number> = {
  groq:      1_000_000,
  gemini:      500_000,
  anthropic:   200_000,
};

function utcDayStart(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Naive in-memory cache — server-side, 30s TTL. Survives within a single
// serverless instance; cold starts re-fetch.
const CACHE_TTL_MS = 30_000;
let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  const isAdminUser = await requireAdmin();
  if (!isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.body);
  }

  const day = utcDayStart();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    perProvider,
    perUser,
    perRoute,
    hourlyTrend,
    configs,
    rejectionsLastHour,
  ] = await Promise.all([
    prisma.tokenUsage.groupBy({
      by: ["provider"],
      where: { day },
      _sum: { inputTokens: true, outputTokens: true, rejectedCalls: true, totalCalls: true },
      _count: { userId: true },
    }),
    prisma.tokenUsage.findMany({
      where: { day },
      include: { user: { select: { email: true, name: true } } },
      orderBy: [{ inputTokens: "desc" }, { outputTokens: "desc" }],
      take: 100,
    }),
    prisma.llmCallLog.groupBy({
      by: ["route"],
      where: { createdAt: { gte: dayAgo }, status: "ok" },
      _sum: { inputTokens: true, outputTokens: true },
      _count: { _all: true },
      orderBy: { _sum: { inputTokens: "desc" } },
      take: 10,
    }),
    prisma.$queryRaw<Array<{ bucket: Date; provider: string; tokens: bigint }>>`
      SELECT
        date_trunc('hour', "createdAt") AS bucket,
        provider,
        SUM("inputTokens" + "outputTokens")::bigint AS tokens
      FROM "LlmCallLog"
      WHERE "createdAt" >= ${dayAgo}
        AND status = 'ok'
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `,
    prisma.quotaConfig.findMany(),
    prisma.llmCallLog.count({
      where: { createdAt: { gte: hourAgo }, status: { in: ["rejected_quota", "rejected_global"] } },
    }),
  ]);

  const cfgByProvider = new Map(configs.map((c) => [c.provider, c]));

  const providersView = perProvider.map((p) => {
    const cfg = cfgByProvider.get(p.provider);
    const dailyBudget = cfg?.dailyBudget ?? DEFAULT_BUDGETS[p.provider] ?? 100_000;
    const globalUsed = (p._sum.inputTokens ?? 0) + (p._sum.outputTokens ?? 0);
    return {
      provider: p.provider,
      enabled: cfg?.enabled ?? true,
      dailyBudget,
      globalUsed,
      pctUsed: dailyBudget ? Math.round((globalUsed / dailyBudget) * 100) : 0,
      activeUsers: p._count.userId,
      totalCalls: p._sum.totalCalls ?? 0,
      rejectedCalls: p._sum.rejectedCalls ?? 0,
    };
  });

  const usersView = perUser.map((u) => {
    const provCfg = cfgByProvider.get(u.provider);
    const dailyBudget = provCfg?.dailyBudget ?? DEFAULT_BUDGETS[u.provider] ?? 100_000;
    const softCapMult = provCfg?.softCapMult ?? 2;
    const activeCount = perProvider.find((p) => p.provider === u.provider)?._count.userId ?? 1;
    const fairShare = dailyBudget ? Math.floor(dailyBudget / Math.max(activeCount, 1)) : 0;
    const softCap = Math.floor(fairShare * softCapMult);
    const used = (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
    return {
      userId: u.userId,
      email: u.user.email,
      name: u.user.name,
      provider: u.provider,
      used,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      totalCalls: u.totalCalls,
      rejectedCalls: u.rejectedCalls,
      fairShare,
      softCap,
      remaining: Math.max(softCap - used, 0),
      lastUpdated: u.updatedAt,
    };
  });

  const routesView = perRoute.map((r) => ({
    route: r.route,
    totalTokens: (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
    calls: r._count._all,
  }));

  // Convert bigint → number for JSON safety
  const hourlyView = hourlyTrend.map((row) => ({
    bucket: row.bucket.toISOString(),
    provider: row.provider,
    tokens: Number(row.tokens),
  }));

  const body = {
    asOf: new Date().toISOString(),
    providers: providersView,
    users: usersView,
    routes: routesView,
    hourly: hourlyView,
    rejectionsLastHour,
  };

  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
