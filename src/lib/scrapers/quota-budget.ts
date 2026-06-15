/**
 * Daily-budget enforcement for paid scraper upstreams.
 *
 * Free tiers are *monthly* (SerpAPI 250/mo, RapidAPI JSearch 200/mo,
 * Adzuna 250/day). With the cron running every 2h, an unbounded scraper
 * would burn the monthly cap in the first few days, leaving the rest of
 * the month at 0. The dashboard then shows a fortnight of red error rows.
 *
 * This helper enforces today-shouldn't-exceed-(monthly/30) before every
 * upstream call. The SystemLog table already records every `logApiCall()`
 * so we read the count directly — no separate counter to keep in sync.
 *
 * Public API:
 *   await canMakeApiCall("serpapi")       → true if today's slice has room
 *   await canMakeApiCall("serpapi", 3)    → true if room for 3 more calls
 *   await budgetStatus("serpapi")          → { dailyUsed, dailySlice, monthlyUsed, monthlyLimit, ok }
 *
 * "Upstream" names match the value passed to `logApiCall()` — that's
 * "serpapi", "jsearch", "adzuna", "groq", "brevo". Scraper-level names
 * (rozee, google, indeed) don't have their own budget — they consume
 * the shared upstream budget.
 */

import { prisma } from "@/lib/prisma";

/**
 * Free-tier monthly limits, single source of truth. Mirrors what each
 * upstream actually grants on its free plan as of 2026-06-15. Override
 * via env when you upgrade a tier — see env doc below the table.
 */
const MONTHLY_FREE_LIMITS: Record<string, number> = {
  serpapi: 250,    // SerpAPI free: 250 searches/month
  jsearch: 200,    // RapidAPI JSearch BASIC: 200 reqs/month
  adzuna: 7500,    // Adzuna free: 250/day × 30 = 7500/month (daily-capped upstream-side anyway)
  groq: 432000,    // 14.4k/day × 30 — Groq has no monthly cap, this just for math
  brevo: 9000,     // 300/day × 30
};

/** Override the monthly cap from env, e.g. SERPAPI_MONTHLY_BUDGET=5000 (post-upgrade). */
function getMonthlyLimit(upstream: string): number {
  const envKey = `${upstream.toUpperCase()}_MONTHLY_BUDGET`;
  const fromEnv = process.env[envKey];
  if (fromEnv) {
    const n = parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return MONTHLY_FREE_LIMITS[upstream] ?? Number.POSITIVE_INFINITY;
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUtc(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface BudgetStatus {
  upstream: string;
  monthlyLimit: number;
  dailySlice: number;
  monthlyUsed: number;
  dailyUsed: number;
  ok: boolean;
  reason?: string;
}

/**
 * Read today + month-to-date usage for an upstream, against the monthly
 * limit divided by 30 (the daily slice). `ok` is false when either the
 * daily slice or the monthly cap is exhausted.
 */
export async function budgetStatus(upstream: string, reserveCalls = 1): Promise<BudgetStatus> {
  const monthlyLimit = getMonthlyLimit(upstream);
  const dailySlice = Math.max(1, Math.floor(monthlyLimit / 30));

  const [dailyUsed, monthlyUsed] = await Promise.all([
    prisma.systemLog.count({
      where: { type: "api_call", source: upstream, createdAt: { gte: startOfTodayUtc() } },
    }),
    prisma.systemLog.count({
      where: { type: "api_call", source: upstream, createdAt: { gte: startOfMonthUtc() } },
    }),
  ]);

  if (monthlyUsed + reserveCalls > monthlyLimit) {
    return {
      upstream,
      monthlyLimit,
      dailySlice,
      monthlyUsed,
      dailyUsed,
      ok: false,
      reason: `Monthly cap exhausted (${monthlyUsed}/${monthlyLimit} used; needed ${reserveCalls} more)`,
    };
  }
  if (dailyUsed + reserveCalls > dailySlice) {
    return {
      upstream,
      monthlyLimit,
      dailySlice,
      monthlyUsed,
      dailyUsed,
      ok: false,
      reason: `Today's slice exhausted (${dailyUsed}/${dailySlice} used; needed ${reserveCalls} more)`,
    };
  }
  return { upstream, monthlyLimit, dailySlice, monthlyUsed, dailyUsed, ok: true };
}

/**
 * Cheap boolean wrapper for the common case. Pass `reserveCalls` when
 * a single scrape run will make multiple upstream calls (rozee makes 3,
 * google-jobs makes 2) — saves making a 4th call after the 3rd starves
 * the next caller mid-run.
 */
export async function canMakeApiCall(upstream: string, reserveCalls = 1): Promise<boolean> {
  // Bypass for tests / dev — set ENFORCE_API_BUDGET=0 to disable the gate.
  if (process.env.ENFORCE_API_BUDGET === "0") return true;
  const status = await budgetStatus(upstream, reserveCalls);
  if (!status.ok) {
    // Log once per non-ok read so the operator sees why a scraper no-op'd.
    // eslint-disable-next-line no-console
    console.warn(`[ApiBudget] ${upstream} gated: ${status.reason}`);
  }
  return status.ok;
}
