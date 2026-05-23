/**
 * GET /api/quota/me
 *
 * Returns the current user's daily AI usage across providers. Feeds the
 * /settings "AI usage" widget — never blocking, never exposing other users' data.
 *
 * No 429 here — this endpoint is the meta endpoint that *describes* the
 * quota state. Querying it should never count against quota.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Fallback per-provider daily budgets used when no QuotaConfig row exists.
// Match src/lib/quota/quota.ts so widget + enforcement agree.
const DEFAULT_BUDGETS: Record<string, number> = {
  groq:      1_000_000,
  gemini:      500_000,
  anthropic:   200_000,
};

function utcDayStart(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET() {
  const __auth = await requireAuthUserId();
  if (__auth.response) return __auth.response;
  const { userId } = __auth;

  const day = utcDayStart();

  const [userRows, providersAgg, configs] = await Promise.all([
    prisma.tokenUsage.findMany({ where: { userId, day } }),
    prisma.tokenUsage.groupBy({
      by: ["provider"],
      where: { day },
      _sum: { inputTokens: true, outputTokens: true },
      _count: { userId: true },
    }),
    prisma.quotaConfig.findMany(),
  ]);

  const configByProvider = new Map(configs.map((c) => [c.provider, c]));
  const usageByProvider = new Map(userRows.map((r) => [r.provider, r]));

  const breakdown = providersAgg.map((row) => {
    const provider = row.provider;
    const globalUsed = (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0);
    const activeUsers = row._count.userId;
    const cfg = configByProvider.get(provider);
    const dailyBudget = cfg?.dailyBudget ?? DEFAULT_BUDGETS[provider] ?? 100_000;
    const softCapMult = cfg?.softCapMult ?? 2;
    const denom = Math.max(activeUsers, 1);
    const fairShare = dailyBudget ? Math.floor(dailyBudget / denom) : 0;
    const softCap = Math.floor(fairShare * softCapMult);
    const userRow = usageByProvider.get(provider);
    const userUsed = (userRow?.inputTokens ?? 0) + (userRow?.outputTokens ?? 0);
    return {
      provider,
      enabled: cfg?.enabled ?? true,
      dailyBudget,
      globalUsed,
      activeUsers,
      fairShare,
      softCap,
      user: {
        used: userUsed,
        remaining: Math.max(softCap - userUsed, 0),
        calls: userRow?.totalCalls ?? 0,
        rejected: userRow?.rejectedCalls ?? 0,
      },
    };
  });

  const nextResetSeconds = Math.floor(
    (new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)).getTime() -
      Date.now()) /
      1000,
  );

  return NextResponse.json({ breakdown, nextResetSeconds });
}
