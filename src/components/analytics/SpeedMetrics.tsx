"use client";

import { Zap, Clock, Target, Send } from "lucide-react";

interface SpeedMetricsProps {
  metrics: {
    avgApplyMinutes: number;
    fastApplyCount: number;
    totalSent: number;
    instantCount: number;
  };
}

export function SpeedMetrics({ metrics }: SpeedMetricsProps) {
  const fastRate = metrics.totalSent > 0
    ? Math.round((metrics.fastApplyCount / metrics.totalSent) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        icon={<Clock className="h-4 w-4" />}
        label="Avg Apply Time"
        value={metrics.avgApplyMinutes > 0 ? `${metrics.avgApplyMinutes} min` : "—"}
        sublabel={metrics.avgApplyMinutes > 0 && metrics.avgApplyMinutes <= 20 ? "Under 20 min target" : undefined}
        gradient="from-blue-500 to-cyan-500"
        good={metrics.avgApplyMinutes > 0 && metrics.avgApplyMinutes <= 20}
      />
      <MetricCard
        icon={<Zap className="h-4 w-4" />}
        label="Instant Applied"
        value={String(metrics.instantCount)}
        sublabel="Auto-sent < 2 min"
        gradient="from-amber-400 to-orange-500"
        good={metrics.instantCount > 0}
      />
      <MetricCard
        icon={<Target className="h-4 w-4" />}
        label="Fast Apply Rate"
        value={`${fastRate}%`}
        sublabel={`${metrics.fastApplyCount} of ${metrics.totalSent} under 20 min`}
        gradient="from-emerald-500 to-teal-500"
        good={fastRate >= 50}
      />
      <MetricCard
        icon={<Send className="h-4 w-4" />}
        label="Total Sent"
        value={String(metrics.totalSent)}
        sublabel="Applications sent"
        gradient="from-violet-500 to-purple-500"
        good={metrics.totalSent > 0}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sublabel,
  gradient,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  gradient: string;
  good: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-lg p-1.5 ${good ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
          {icon}
        </div>
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}
