"use client";

import {
  Briefcase,
  Send,
  MessageSquare,
  Trophy,
  TrendingUp,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Job } from "@/types";

interface StatsBarProps {
  jobs: Job[];
}

export function StatsBar({ jobs }: StatsBarProps) {
  const total = jobs.length;
  const applied = jobs.filter((j) => j.stage !== "SAVED").length;
  const interviews = jobs.filter((j) => j.stage === "INTERVIEW").length;
  const offers = jobs.filter((j) => j.stage === "OFFER").length;
  const responseRate =
    applied > 0 ? Math.round(((interviews + offers) / applied) * 100) : 0;

  const todayApplied = jobs.filter((j) => {
    if (!j.appliedDate) return false;
    const d = new Date(j.appliedDate);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }).length;

  const dailyTarget = 5;
  const dailyProgress = Math.min((todayApplied / dailyTarget) * 100, 100);

  const stats = [
    {
      label: "Total Jobs",
      value: total,
      icon: Briefcase,
      color: "text-slate-700",
      bg: "bg-slate-50",
    },
    {
      label: "Applied",
      value: applied,
      icon: Send,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "Interviews",
      value: interviews,
      icon: MessageSquare,
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Offers",
      value: offers,
      icon: Trophy,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      icon: TrendingUp,
      color: "text-purple-700",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="flex items-center gap-3 p-4 rounded-xl border-0 shadow-sm"
          >
            <div className={`rounded-lg p-2 ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Daily target */}
      <Card className="flex items-center gap-4 p-4 rounded-xl border-0 shadow-sm">
        <div className="rounded-lg bg-blue-50 p-2">
          <Target className="h-4 w-4 text-blue-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-slate-700">
              Daily Target
            </p>
            <p className="text-sm font-bold text-blue-700">
              {todayApplied}/{dailyTarget}
            </p>
          </div>
          <Progress value={dailyProgress} className="h-2" />
        </div>
      </Card>
    </div>
  );
}
