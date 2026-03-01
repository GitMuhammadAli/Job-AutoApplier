"use client";

import {
  Briefcase,
  Send,
  MessageSquare,
  Trophy,
  TrendingUp,
  Ghost,
  XCircle,
} from "lucide-react";

interface AnalyticsData {
  totalJobs: number;
  applied: number;
  interviews: number;
  offers: number;
  rejected: number;
  ghosted: number;
  responseRate: number;
}

interface StatsBarProps {
  analytics?: AnalyticsData;
  jobs?: { stage: string }[];
}

const STAT_CONFIGS = [
  { key: "total", label: "Total Jobs", icon: Briefcase, iconBg: "bg-slate-100 dark:bg-slate-800", iconColor: "text-slate-600 dark:text-slate-400", gradient: "from-slate-500 to-slate-700" },
  { key: "applied", label: "Applied", icon: Send, iconBg: "bg-blue-100 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400", gradient: "from-blue-500 to-blue-700" },
  { key: "interviews", label: "Interviews", icon: MessageSquare, iconBg: "bg-amber-100 dark:bg-amber-900/40", iconColor: "text-amber-600 dark:text-amber-400", gradient: "from-amber-500 to-amber-700" },
  { key: "offers", label: "Offers", icon: Trophy, iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconColor: "text-emerald-600 dark:text-emerald-400", gradient: "from-emerald-500 to-emerald-700" },
  { key: "rejected", label: "Rejected", icon: XCircle, iconBg: "bg-red-100 dark:bg-red-900/40", iconColor: "text-red-500 dark:text-red-400", gradient: "from-red-400 to-red-600" },
  { key: "ghosted", label: "Ghosted", icon: Ghost, iconBg: "bg-slate-100 dark:bg-slate-800", iconColor: "text-slate-500 dark:text-slate-400", gradient: "from-slate-400 to-slate-600" },
  { key: "response", label: "Response Rate", icon: TrendingUp, iconBg: "bg-violet-100 dark:bg-violet-900/40", iconColor: "text-violet-600 dark:text-violet-400", gradient: "from-violet-500 to-violet-700" },
] as const;

export function StatsBar({ analytics, jobs }: StatsBarProps) {
  let data: AnalyticsData;

  if (analytics) {
    data = analytics;
  } else {
    const list = jobs ?? [];
    const totalJobs = list.length;
    const applied = list.filter((j) => j.stage !== "SAVED").length;
    const interviews = list.filter((j) => j.stage === "INTERVIEW").length;
    const offers = list.filter((j) => j.stage === "OFFER").length;
    const rejected = list.filter((j) => j.stage === "REJECTED").length;
    const ghosted = list.filter((j) => j.stage === "GHOSTED").length;
    const responseRate = applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;
    data = { totalJobs, applied, interviews, offers, rejected, ghosted, responseRate };
  }

  const values: Record<string, string | number> = {
    total: data.totalJobs,
    applied: data.applied,
    interviews: data.interviews,
    offers: data.offers,
    rejected: data.rejected,
    ghosted: data.ghosted,
    response: `${data.responseRate}%`,
  };

  return (
    <div className="flex overflow-x-auto gap-1.5 sm:gap-2 pb-1 scrollbar-none sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:overflow-x-visible">
      {STAT_CONFIGS.map((stat, idx) => (
        <div
          key={stat.key}
          className="group relative overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-2.5 sm:p-3 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-all hover:shadow-md hover:-translate-y-0.5 shrink-0 min-w-[110px] sm:min-w-0"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${stat.gradient}`} />
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg ${stat.iconBg}`}>
              <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{values[stat.key]}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
