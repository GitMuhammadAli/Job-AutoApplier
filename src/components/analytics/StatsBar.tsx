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
import type { UserJobWithGlobal } from "@/store/useJobStore";

interface StatsBarProps {
  jobs: UserJobWithGlobal[];
}

const STAT_CONFIGS = [
  { key: "total", label: "Total Jobs", icon: Briefcase, iconBg: "bg-slate-100", iconColor: "text-slate-600", gradient: "from-slate-500 to-slate-700" },
  { key: "applied", label: "Applied", icon: Send, iconBg: "bg-blue-100", iconColor: "text-blue-600", gradient: "from-blue-500 to-blue-700" },
  { key: "interviews", label: "Interviews", icon: MessageSquare, iconBg: "bg-amber-100", iconColor: "text-amber-600", gradient: "from-amber-500 to-amber-700" },
  { key: "offers", label: "Offers", icon: Trophy, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", gradient: "from-emerald-500 to-emerald-700" },
  { key: "rejected", label: "Rejected", icon: XCircle, iconBg: "bg-red-100", iconColor: "text-red-500", gradient: "from-red-400 to-red-600" },
  { key: "ghosted", label: "Ghosted", icon: Ghost, iconBg: "bg-slate-100", iconColor: "text-slate-500", gradient: "from-slate-400 to-slate-600" },
  { key: "response", label: "Response Rate", icon: TrendingUp, iconBg: "bg-violet-100", iconColor: "text-violet-600", gradient: "from-violet-500 to-violet-700" },
] as const;

export function StatsBar({ jobs }: StatsBarProps) {
  const total = jobs.length;
  const applied = jobs.filter((j) => j.stage !== "SAVED").length;
  const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
  const offers = jobs.filter((j) => j.stage === "OFFER").length;
  const rejected = jobs.filter((j) => j.stage === "REJECTED").length;
  const ghosted = jobs.filter((j) => j.stage === "GHOSTED").length;
  const responseRate =
    applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

  const values: Record<string, string | number> = {
    total, applied, interviews, offers, rejected, ghosted,
    response: `${responseRate}%`,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
      {STAT_CONFIGS.map((stat, idx) => (
        <div
          key={stat.key}
          className="group relative overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-3 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-all hover:shadow-md hover:-translate-y-0.5"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${stat.gradient}`} />
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg}`}>
              <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{values[stat.key]}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
