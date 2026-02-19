"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface WeeklyComparisonProps {
  data: {
    thisWeek: { applications: number; matches: number };
    lastWeek: { applications: number; matches: number };
  };
}

function ChangeIndicator({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0 && current === 0) {
    return <Minus className="h-3 w-3 text-slate-400" />;
  }
  const pct =
    previous === 0
      ? 100
      : Math.round(((current - previous) / previous) * 100);

  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
        <ArrowUp className="h-3 w-3" />+{pct}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400 text-xs font-semibold">
        <ArrowDown className="h-3 w-3" />{pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-400 dark:text-zinc-500 text-xs font-semibold">
      <Minus className="h-3 w-3" />0%
    </span>
  );
}

export function WeeklyComparison({ data }: WeeklyComparisonProps) {
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700/50">
      <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
        This Week vs Last Week
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-50 dark:bg-zinc-700/50 p-3">
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
            Applications
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-800 dark:text-zinc-100 tabular-nums">
              {data.thisWeek.applications}
            </span>
            <ChangeIndicator
              current={data.thisWeek.applications}
              previous={data.lastWeek.applications}
            />
          </div>
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
            Last week: {data.lastWeek.applications}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-zinc-700/50 p-3">
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
            New Matches
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-800 dark:text-zinc-100 tabular-nums">
              {data.thisWeek.matches}
            </span>
            <ChangeIndicator
              current={data.thisWeek.matches}
              previous={data.lastWeek.matches}
            />
          </div>
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
            Last week: {data.lastWeek.matches}
          </div>
        </div>
      </div>
    </div>
  );
}
