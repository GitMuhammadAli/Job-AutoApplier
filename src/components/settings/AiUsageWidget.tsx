"use client";

/**
 * AI Usage widget — shows the user their daily token quota.
 *
 * Mount in /settings/account or as a sidebar pill. Polls /api/quota/me
 * every 60s while the page is open. Falls silent when no providers are
 * configured server-side.
 */

import { useEffect, useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";

type Breakdown = {
  provider: string;
  enabled: boolean;
  dailyBudget: number;
  globalUsed: number;
  fairShare: number;
  softCap: number;
  user: {
    used: number;
    remaining: number;
    calls: number;
    rejected: number;
  };
};

type ApiBody = {
  breakdown: Breakdown[];
  nextResetSeconds: number;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AiUsageWidget() {
  const [data, setData] = useState<ApiBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/quota/me", { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setError(`HTTP ${r.status}`);
          return;
        }
        const body = (await r.json()) as ApiBody;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) return null; // silent failure — widget is non-critical
  if (!data || data.breakdown.length === 0) return null;

  // Show only the provider with the highest pct-used (the one closest to limiting the user)
  const headline = data.breakdown.reduce<Breakdown | null>((best, cur) => {
    if (!cur.enabled) return best;
    if (!best) return cur;
    const bestPct = best.softCap ? best.user.used / best.softCap : 0;
    const curPct = cur.softCap ? cur.user.used / cur.softCap : 0;
    return curPct > bestPct ? cur : best;
  }, null);

  if (!headline) return null;

  const pctUsed = headline.softCap > 0 ? Math.min(100, (headline.user.used / headline.softCap) * 100) : 0;
  const isWarning = pctUsed >= 80;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          AI usage today
        </h3>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
          {headline.provider}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold">{formatTokens(headline.user.used)}</span>
          <span className="text-zinc-500"> / {formatTokens(headline.softCap)} tokens</span>
        </span>
        <span className="text-zinc-500 text-[11px]">
          Resets in {formatCountdown(data.nextResetSeconds)}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            pctUsed >= 95 ? "bg-red-500" : pctUsed >= 80 ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pctUsed}%` }}
        />
      </div>
      {isWarning && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 pt-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            You&apos;re using a lot of AI today. Calls may be paused later — your share resets at midnight UTC.
          </span>
        </p>
      )}
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        {headline.user.calls} call{headline.user.calls !== 1 ? "s" : ""}{" "}
        {headline.user.rejected > 0 && (
          <span className="text-amber-600 dark:text-amber-400">· {headline.user.rejected} rate-limited</span>
        )}
      </p>
    </div>
  );
}
