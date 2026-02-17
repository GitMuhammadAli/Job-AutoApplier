"use client";

import {
  Briefcase,
  Send,
  MessageSquare,
  Trophy,
  TrendingUp,
  Target,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Job } from "@/types";

interface StatsBarProps {
  jobs: Job[];
}

const STAT_CONFIGS = [
  {
    key: "total",
    label: "Total Jobs",
    icon: Briefcase,
    gradient: "from-slate-500 to-slate-700",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    ring: "ring-slate-200/50",
  },
  {
    key: "applied",
    label: "Applied",
    icon: Send,
    gradient: "from-blue-500 to-blue-700",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    ring: "ring-blue-200/50",
  },
  {
    key: "interviews",
    label: "Interviews",
    icon: MessageSquare,
    gradient: "from-amber-500 to-amber-700",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    ring: "ring-amber-200/50",
  },
  {
    key: "offers",
    label: "Offers",
    icon: Trophy,
    gradient: "from-emerald-500 to-emerald-700",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    ring: "ring-emerald-200/50",
  },
  {
    key: "response",
    label: "Response Rate",
    icon: TrendingUp,
    gradient: "from-violet-500 to-violet-700",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    ring: "ring-violet-200/50",
  },
] as const;

export function StatsBar({ jobs }: StatsBarProps) {
  const total = jobs.length;
  const applied = jobs.filter((j) => j.stage !== "SAVED").length;
  const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
  const offers = jobs.filter((j) => j.stage === "OFFER").length;
  const responseRate =
    applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

  const values: Record<string, string | number> = {
    total,
    applied,
    interviews,
    offers,
    response: `${responseRate}%`,
  };

  const todayApplied = jobs.filter((j) => {
    if (!j.appliedDate) return false;
    const d = new Date(j.appliedDate);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const dailyTarget = 5;
  const dailyProgress = Math.min((todayApplied / dailyTarget) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {STAT_CONFIGS.map((stat, idx) => (
          <div
            key={stat.key}
            className="group relative overflow-hidden rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            {/* Subtle gradient top accent */}
            <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${stat.gradient}`} />

            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg} ring-1 ${stat.ring}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900 animate-count-up">{values[stat.key]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily target bar */}
      <div className="relative overflow-hidden rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/60">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 ring-1 ring-blue-200/50">
            <Target className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-700">
                Daily Target
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-blue-600">{todayApplied}</span>
                <span className="text-xs text-slate-400">/ {dailyTarget}</span>
              </div>
            </div>
            <div className="relative">
              <Progress value={dailyProgress} className="h-2" />
              {dailyProgress >= 100 && (
                <span className="ml-2 text-[10px] font-semibold text-emerald-600">Target hit!</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
