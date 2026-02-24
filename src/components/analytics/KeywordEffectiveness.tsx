"use client";

import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KeywordStat {
  keyword: string;
  matches: number;
  saves: number;
  dismisses: number;
  applied: number;
}

export function KeywordEffectiveness({ data }: { data: KeywordStat[] }) {
  if (!data || data.length === 0) return null;

  const maxMatches = Math.max(...data.map((d) => d.matches), 1);

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
          <Target className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Keyword Effectiveness</h3>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">Which keywords produce results and which to reconsider</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.map((kw) => {
          const pct = Math.round((kw.matches / maxMatches) * 100);
          const effectiveness = kw.matches > 0
            ? Math.round(((kw.saves + kw.applied) / kw.matches) * 100)
            : 0;

          let statusColor = "text-slate-400 dark:text-zinc-500";
          let StatusIcon = Minus;
          let statusLabel = "No data";

          if (kw.matches === 0) {
            statusColor = "text-red-500";
            StatusIcon = TrendingDown;
            statusLabel = "0 matches";
          } else if (effectiveness >= 60) {
            statusColor = "text-emerald-500";
            StatusIcon = TrendingUp;
            statusLabel = `${effectiveness}% useful`;
          } else if (effectiveness >= 30) {
            statusColor = "text-amber-500";
            StatusIcon = Minus;
            statusLabel = `${effectiveness}% useful`;
          } else {
            statusColor = "text-red-400";
            StatusIcon = TrendingDown;
            statusLabel = `${effectiveness}% useful`;
          }

          return (
            <div key={kw.keyword} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-zinc-200">{kw.keyword}</span>
                  <div className="flex items-center gap-0.5">
                    <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                    <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] tabular-nums">
                  <span className="text-slate-500 dark:text-zinc-400">{kw.matches} matches</span>
                  {kw.applied > 0 && <span className="text-emerald-600 dark:text-emerald-400">{kw.applied} applied</span>}
                  {kw.dismisses > 0 && <span className="text-red-400">{kw.dismisses} dismissed</span>}
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    kw.matches === 0 ? "bg-red-300 dark:bg-red-700" :
                    effectiveness >= 60 ? "bg-emerald-500" :
                    effectiveness >= 30 ? "bg-amber-500" : "bg-red-400"
                  }`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {data.some((kw) => kw.matches === 0) && (
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-[11px] text-amber-700 dark:text-amber-300">
          <strong>Tip:</strong> Keywords with 0 matches aren&apos;t finding any jobs in your market. Consider replacing them with alternatives or removing them to keep your dashboard focused.
        </div>
      )}
    </div>
  );
}
