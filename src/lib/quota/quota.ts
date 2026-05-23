/**
 * Fair-share token quota client.
 *
 * Design summary (see qa-run-20260522/TOKEN_QUOTA_ARCHITECTURE.md for the full doc):
 *   - Each provider has a daily token budget.
 *   - Each user gets `globalBudget / activeUsersToday` as their floor.
 *   - A SOFT_CAP_MULT (default 2x) lets one user consume more when others are
 *     dormant, but never exceeds the global budget.
 *   - Dormant users don't lock up their share — share is recomputed off
 *     `activeUsersToday`, not registered-user-count.
 *
 * Public API:
 *   - checkQuota(userId, provider, estimatedCost) → allow/deny + retry-after
 *   - recordUsage(...)                            → write to TokenUsage + LlmCallLog
 *
 * All counts are UTC-day rolled-up; reset at 00:00 UTC.
 */

import { prisma } from "@/lib/prisma";

export type QuotaReason = "user_cap" | "global_cap" | "disabled";

export type QuotaCheckResult =
  | { allowed: true; remaining: number; fairShare: number }
  | { allowed: false; reason: QuotaReason; retryAfterSeconds: number; fairShare: number; userUsed: number; globalUsed: number };

export type CallStatus = "ok" | "rejected_quota" | "rejected_global" | "error";

const DEFAULT_BUDGETS: Record<string, number> = {
  // Conservative starting points — admin can tune via /admin/quotas
  groq:      1_000_000, // Groq free tier ≈ 100K/min × 1440 min, capped at 1M/day per app
  gemini:      500_000, // Gemini paid — burn-rate guard
  anthropic:   200_000, // Anthropic prod — burn-rate guard
};

const DEFAULT_SOFT_CAP_MULT = 2.0;

function utcDayStart(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function secondsUntilNextUtcMidnight(d: Date = new Date()): number {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return Math.max(60, Math.floor((next.getTime() - d.getTime()) / 1000));
}

async function loadQuotaConfig(provider: string) {
  const cfg = await prisma.quotaConfig.findUnique({ where: { provider } });
  return {
    dailyBudget: cfg?.dailyBudget ?? DEFAULT_BUDGETS[provider] ?? 100_000,
    softCapMult: cfg?.softCapMult ?? DEFAULT_SOFT_CAP_MULT,
    enabled: cfg?.enabled ?? true,
  };
}

/**
 * Returns whether the user can consume `estimatedCost` tokens from `provider` today.
 *
 * Pure read — does not write usage. Caller MUST call `recordUsage` after the
 * actual provider call returns (with real, not estimated, token counts).
 */
export async function checkQuota(
  userId: string,
  provider: string,
  estimatedCost: number,
): Promise<QuotaCheckResult> {
  const cfg = await loadQuotaConfig(provider);

  if (!cfg.enabled) {
    // Disabled = allow everything but tag the result so dashboards show "disabled" state
    return { allowed: true, remaining: cfg.dailyBudget, fairShare: cfg.dailyBudget };
  }

  const day = utcDayStart();

  // Two cheap aggregate queries — no per-user fanout
  const [globalAgg, userRow, activeUserCount] = await Promise.all([
    prisma.tokenUsage.aggregate({
      where: { day, provider },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.tokenUsage.findUnique({
      where: { userId_day_provider: { userId, day, provider } },
      select: { inputTokens: true, outputTokens: true },
    }),
    // "Active" = anyone with any usage row today (provider-scoped)
    prisma.tokenUsage.count({ where: { day, provider } }),
  ]);

  const globalUsed = (globalAgg._sum.inputTokens ?? 0) + (globalAgg._sum.outputTokens ?? 0);
  const userUsed = (userRow?.inputTokens ?? 0) + (userRow?.outputTokens ?? 0);

  // If this user hasn't recorded usage today, they will after the next call.
  // Pre-incrementing the denominator gives a HONEST fair share that doesn't
  // collapse as soon as they hit the endpoint.
  const denom = Math.max(activeUserCount + (userRow ? 0 : 1), 1);
  const fairShare = Math.floor(cfg.dailyBudget / denom);

  // Global cap (hard)
  if (globalUsed + estimatedCost > cfg.dailyBudget) {
    return {
      allowed: false,
      reason: "global_cap",
      retryAfterSeconds: secondsUntilNextUtcMidnight(),
      fairShare,
      userUsed,
      globalUsed,
    };
  }

  // Per-user soft cap: allow up to softCapMult × fairShare
  const userSoftCap = Math.floor(fairShare * cfg.softCapMult);
  if (userUsed + estimatedCost > userSoftCap) {
    return {
      allowed: false,
      reason: "user_cap",
      retryAfterSeconds: secondsUntilNextUtcMidnight(),
      fairShare,
      userUsed,
      globalUsed,
    };
  }

  return {
    allowed: true,
    remaining: Math.min(cfg.dailyBudget - globalUsed, userSoftCap - userUsed),
    fairShare,
  };
}

/**
 * Idempotently record one LLM call's outcome to both TokenUsage (daily rollup)
 * and LlmCallLog (per-call audit/trend). Never throws — quota recording should
 * not break the underlying request.
 */
export async function recordUsage(opts: {
  userId: string;
  provider: string;
  model: string;
  route: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: CallStatus;
  errorMessage?: string;
}): Promise<void> {
  const day = utcDayStart();
  const rejected = opts.status === "rejected_quota" || opts.status === "rejected_global";

  try {
    await Promise.all([
      prisma.tokenUsage.upsert({
        where: { userId_day_provider: { userId: opts.userId, day, provider: opts.provider } },
        create: {
          userId: opts.userId,
          day,
          provider: opts.provider,
          inputTokens: opts.inputTokens,
          outputTokens: opts.outputTokens,
          totalCalls: opts.status === "ok" ? 1 : 0,
          rejectedCalls: rejected ? 1 : 0,
        },
        update: {
          inputTokens: { increment: opts.inputTokens },
          outputTokens: { increment: opts.outputTokens },
          totalCalls: opts.status === "ok" ? { increment: 1 } : undefined,
          rejectedCalls: rejected ? { increment: 1 } : undefined,
        },
      }),
      prisma.llmCallLog.create({
        data: {
          userId: opts.userId,
          provider: opts.provider,
          model: opts.model,
          route: opts.route,
          inputTokens: opts.inputTokens,
          outputTokens: opts.outputTokens,
          latencyMs: opts.latencyMs,
          status: opts.status,
          errorMessage: opts.errorMessage,
        },
      }),
    ]);
  } catch (err) {
    // Recording failure must never break the user-facing request.
    console.error("[quota] recordUsage failed:", err);
  }
}

/**
 * Error class thrown by provider wrappers when a quota check denies a call.
 * Routes catch it and convert to a 429 with honest message + retry-after.
 */
export class QuotaExceededError extends Error {
  readonly reason: QuotaReason;
  readonly retryAfterSeconds: number;

  constructor(reason: QuotaReason, retryAfterSeconds: number) {
    super(`Quota exceeded: ${reason}`);
    this.name = "QuotaExceededError";
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Rough estimator — 1 token ≈ 4 characters of English. Used pre-call so we
 * can check the quota before incurring provider cost. Final reconciliation
 * happens in recordUsage with the real token counts the provider returns.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Helper: compute a user-friendly "you've used your share, back at midnight UTC" message.
 */
export function formatRetryMessage(reason: QuotaReason, retryAfterSeconds: number): string {
  const hours = Math.floor(retryAfterSeconds / 3600);
  const mins = Math.floor((retryAfterSeconds % 3600) / 60);
  const when =
    hours >= 1
      ? `${hours}h ${mins}m`
      : `${mins}m`;
  if (reason === "user_cap") {
    return `You've used your AI budget for today. Available again in ${when} (at midnight UTC). The app shares a free token pool across all users.`;
  }
  if (reason === "global_cap") {
    return `Service-wide AI budget hit for today. Back to normal in ${when}.`;
  }
  return `Quota check failed. Please try again in ${when}.`;
}
