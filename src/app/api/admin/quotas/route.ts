import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ADMIN, GENERIC } from "@/lib/messages";
import { captureError } from "@/lib/observability/capture";

export const dynamic = "force-dynamic";

/**
 * Actual free-tier monthly caps (corrected 2026-06-15 against the probe in
 * scripts/probe-scrapers.mjs). The `daily` field is now the "daily slice"
 * = floor(monthly / 30) — the cap the budget enforcer in
 * src/lib/scrapers/quota-budget.ts uses to spread the monthly free tier
 * across the month instead of burning it in the first week.
 *
 * Override via env when you upgrade a plan, e.g. SERPAPI_MONTHLY_BUDGET=5000.
 */
function monthlyCap(upstream: string, fallback: number): number {
  const envKey = `${upstream.toUpperCase()}_MONTHLY_BUDGET`;
  const v = process.env[envKey];
  if (v) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function buildLimits(): Record<string, { daily: number; monthly: number }> {
  const out: Record<string, { daily: number; monthly: number }> = {};
  const monthly = {
    jsearch: monthlyCap("jsearch", 200),
    adzuna: monthlyCap("adzuna", 7500),
    serpapi: monthlyCap("serpapi", 250),
    groq: monthlyCap("groq", 432000),
    brevo: monthlyCap("brevo", 9000),
  };
  for (const [k, m] of Object.entries(monthly)) {
    out[k] = { monthly: m, daily: Math.max(1, Math.floor(m / 30)) };
  }
  return out;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: ADMIN.FORBIDDEN }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const QUOTA_LIMITS = buildLimits();
    const quotas = await Promise.all(
      Object.entries(QUOTA_LIMITS).map(async ([name, limits]) => {
        const [dailyUsed, monthlyUsed] = await Promise.all([
          prisma.systemLog.count({
            where: {
              type: "api_call",
              source: name,
              createdAt: { gte: todayStart },
            },
          }),
          prisma.systemLog.count({
            where: {
              type: "api_call",
              source: name,
              createdAt: { gte: monthStart },
            },
          }),
        ]);
        return {
          name,
          dailyUsed,
          dailyLimit: limits.daily,
          monthlyUsed,
          monthlyLimit: limits.monthly,
        };
      }),
    );

    return NextResponse.json(quotas, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    await captureError(error, { route: "/api/admin/quotas" });
    return NextResponse.json({ error: GENERIC.INTERNAL_ERROR }, { status: 500 });
  }
}
