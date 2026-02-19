"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  Send,
  AlertTriangle,
  RefreshCw,
  Activity,
  Loader2,
  Zap,
  Ban,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AdminStats {
  users: { total: number; active: number; paused: number; neverOnboarded: number };
  jobs: { active: number; inactive: number; fresh: number };
  applicationsToday: { sent: number; failed: number; bounced: number };
  scrapers: {
    source: string;
    lastRun: string | null;
    lastMessage: string | null;
    jobCount: number;
    isHealthy: boolean;
    lastError: string | null;
  }[];
  quotas: Record<string, { used: number; limit: number; period: string }>;
  recentErrors: { message: string; createdAt: string; source: string | null }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      toast.error("Failed to load admin stats");
    }
    setLoading(false);
  }

  async function handleTrigger(source: string) {
    setTriggeringSource(source);
    try {
      const res = await fetch("/api/admin/scrapers/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Triggered ${source}: ${JSON.stringify(data).slice(0, 80)}`);
        fetchStats();
      } else {
        toast.error(data.error || "Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger");
    }
    setTriggeringSource(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">System overview and controls</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchStats} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => handleTrigger("all")}
            disabled={!!triggeringSource}
            className="gap-1.5"
          >
            {triggeringSource === "all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Scrape All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTrigger("instant-apply")}
            disabled={!!triggeringSource}
            className="gap-1.5"
          >
            {triggeringSource === "instant-apply" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Instant Apply
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Users className="h-4 w-4 text-blue-600" />} label="Total Users" value={stats.users.total} bg="bg-blue-50" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Active" value={stats.users.active} bg="bg-emerald-50" />
        <StatCard icon={<Briefcase className="h-4 w-4 text-violet-600" />} label="Active Jobs" value={stats.jobs.active} bg="bg-violet-50" />
        <StatCard icon={<Clock className="h-4 w-4 text-cyan-600" />} label="Fresh Jobs" value={stats.jobs.fresh} bg="bg-cyan-50" />
        <StatCard icon={<Send className="h-4 w-4 text-emerald-600" />} label="Sent Today" value={stats.applicationsToday.sent} bg="bg-emerald-50" />
        <StatCard icon={<Ban className="h-4 w-4 text-red-600" />} label="Bounced Today" value={stats.applicationsToday.bounced} bg="bg-red-50" />
      </div>

      {/* Scraper Health */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
        <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
          Scraper Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.scrapers.map((s) => (
            <div
              key={s.source}
              className={`rounded-lg p-3 ring-1 ${
                s.isHealthy
                  ? "bg-emerald-50/50 dark:bg-emerald-900/30 ring-emerald-100/50 dark:ring-emerald-800/50"
                  : "bg-red-50/50 dark:bg-red-900/30 ring-red-100/50 dark:ring-red-800/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 capitalize">{s.source}</span>
                <span className={`h-2 w-2 rounded-full ${s.isHealthy ? "bg-emerald-500" : "bg-red-400"}`} />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                {s.lastRun ? new Date(s.lastRun).toLocaleString() : "Never run"}
              </div>
              {s.lastMessage && (
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{s.lastMessage}</div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2 mt-1.5"
                disabled={!!triggeringSource}
                onClick={() => handleTrigger(s.source)}
              >
                {triggeringSource === s.source ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Zap className="h-3 w-3 mr-1" />
                )}
                Trigger
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* API Quotas */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
        <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3">API Quotas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(stats.quotas).map(([name, q]) => {
            const pct = Math.min(Math.round((q.used / q.limit) * 100), 100);
            const isWarning = pct >= 80;
            return (
              <div key={name} className="rounded-lg bg-slate-50 dark:bg-zinc-800/50 p-3 ring-1 ring-slate-100 dark:ring-zinc-700">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 capitalize">{name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">/{q.period}</span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-zinc-100 tabular-nums mt-0.5">
                  {q.used} / {q.limit}
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isWarning ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Errors */}
      {stats.recentErrors.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
          <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Recent Errors (24h)
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stats.recentErrors.map((err, i) => (
              <div key={i} className="rounded-lg bg-red-50/50 dark:bg-red-900/30 p-3 ring-1 ring-red-100/50 dark:ring-red-800/50">
                <div className="flex items-center gap-2 text-[10px] text-red-400 mb-1">
                  {err.source && <span className="font-medium">{err.source}</span>}
                  <span>{new Date(err.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} p-4 ring-1 ring-slate-100/50 dark:ring-zinc-700/50`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <div className="text-lg font-bold text-slate-800 dark:text-zinc-100 tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-slate-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}
