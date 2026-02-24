"use client";

import { useEffect, useState, useCallback } from "react";
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
  FileText,
  Mail,
  Play,
  Database,
  Server,
  TrendingUp,
  Trash2,
  BarChart3,
  Shield,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AdminStats {
  users: { total: number; active: number; paused: number; neverOnboarded: number };
  jobs: { active: number; inactive: number; fresh: number; sourceDistribution: Record<string, number> };
  applicationsToday: { sent: number; failed: number; bounced: number };
  applicationPipeline: { draft: number; ready: number; sending: number; sentTotal: number; sentThisWeek: number };
  scrapers: {
    source: string;
    lastRun: string | null;
    lastMessage: string | null;
    jobCount: number;
    updatedCount: number;
    totalJobs: number;
    isHealthy: boolean;
    lastError: string | null;
    lastErrorAt: string | null;
  }[];
  crons: {
    key: string;
    label: string;
    lastRun: string | null;
    lastMessage: string | null;
    isRunning: boolean;
    startedAt: string | null;
  }[];
  locks: { name: string; isRunning: boolean; startedAt: string | null; completedAt: string | null }[];
  quotas: Record<string, { used: number; limit: number; period: string }>;
  recentErrors: { message: string; createdAt: string; source: string | null }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      toast.error("Failed to load admin stats");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

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
        toast.success(`${source}: ${data.results ? `${data.results.length} sources triggered` : "triggered"}`);
        setTimeout(fetchStats, 3000);
      } else {
        toast.error(data.error || "Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger");
    }
    setTriggeringSource(null);
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
        <p className="text-sm text-slate-500 dark:text-zinc-400">Failed to load admin stats</p>
        <Button size="sm" variant="outline" onClick={fetchStats} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />Retry
        </Button>
      </div>
    );
  }

  const healthyScrapers = stats.scrapers.filter((s) => s.isHealthy).length;
  const runningLocks = stats.locks.filter((l) => l.isRunning);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Admin Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            System overview &middot; {healthyScrapers}/{stats.scrapers.length} scrapers healthy
            {runningLocks.length > 0 && (
              <span className="text-amber-500 ml-2">
                &middot; {runningLocks.length} lock{runningLocks.length > 1 ? "s" : ""} active
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={fetchStats} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleTrigger("all")} disabled={!!triggeringSource} className="gap-1.5">
            {triggeringSource === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Scrape All
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTrigger("instant-apply")} disabled={!!triggeringSource} className="gap-1.5">
            {triggeringSource === "instant-apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Instant Apply
          </Button>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard icon={<Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />} label="Users" value={stats.users.total} sub={`${stats.users.active} active`} />
        <StatCard icon={<Briefcase className="h-4 w-4 text-violet-600 dark:text-violet-400" />} label="Active Jobs" value={stats.jobs.active} sub={`${stats.jobs.fresh} fresh`} />
        <StatCard icon={<FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />} label="Drafts" value={stats.applicationPipeline.draft} />
        <StatCard icon={<Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />} label="Ready" value={stats.applicationPipeline.ready} />
        <StatCard icon={<Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />} label="Sent Today" value={stats.applicationsToday.sent} sub={`${stats.applicationPipeline.sentThisWeek} this week`} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />} label="Failed" value={stats.applicationsToday.failed} />
        <StatCard icon={<Ban className="h-4 w-4 text-orange-600 dark:text-orange-400" />} label="Bounced" value={stats.applicationsToday.bounced} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />} label="Total Sent" value={stats.applicationPipeline.sentTotal} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scraper Health */}
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
          <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            Scraper Health
            <span className="text-[10px] font-normal text-slate-400 dark:text-zinc-500 ml-auto">
              {healthyScrapers}/{stats.scrapers.length} healthy
            </span>
          </h2>
          <div className="space-y-2">
            {stats.scrapers.map((s) => (
              <div key={s.source} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${s.isHealthy ? "bg-emerald-500" : "bg-red-400"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 capitalize">{s.source}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">
                      {s.totalJobs.toLocaleString()} jobs
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                    {s.lastRun ? timeAgo(s.lastRun) : "Never run"}
                    {s.lastMessage && ` \u00B7 ${s.lastMessage}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] flex-shrink-0"
                  disabled={!!triggeringSource}
                  onClick={() => handleTrigger(s.source)}
                >
                  {triggeringSource === s.source ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Job Distribution */}
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
          <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            Jobs by Source
            <span className="text-[10px] font-normal text-slate-400 dark:text-zinc-500 ml-auto">
              {stats.jobs.active.toLocaleString()} total active
            </span>
          </h2>
          <div className="space-y-2">
            {Object.entries(stats.jobs.sourceDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => {
                const pct = Math.round((count / Math.max(stats.jobs.active, 1)) * 100);
                return (
                  <div key={source} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-zinc-200 capitalize">{source}</span>
                      <span className="text-slate-400 dark:text-zinc-500 tabular-nums">{count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-700">
                      <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cron Jobs & System Actions */}
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
          <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            Cron Jobs &amp; Actions
          </h2>
          <div className="space-y-1.5">
            {stats.crons.map((cron) => (
              <div key={cron.key} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cron.isRunning ? "bg-amber-500 animate-pulse" : "bg-slate-300 dark:bg-zinc-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-700 dark:text-zinc-200">{cron.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                    {cron.isRunning
                      ? `Running since ${cron.startedAt ? timeAgo(cron.startedAt) : "unknown"}`
                      : cron.lastRun ? `Last: ${timeAgo(cron.lastRun)}` : "Never run"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] flex-shrink-0"
                  disabled={!!triggeringSource || cron.isRunning}
                  onClick={() => handleTrigger(cron.key)}
                >
                  {triggeringSource === cron.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : cron.isRunning ? (
                    <Activity className="h-3 w-3 text-amber-500" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-700">
            <h3 className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={!!triggeringSource} onClick={() => handleTrigger("send-scheduled")}>
                <Mail className="h-3 w-3" /> Send Scheduled
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={!!triggeringSource} onClick={() => handleTrigger("send-queued")}>
                <Send className="h-3 w-3" /> Send Queued
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={!!triggeringSource} onClick={() => handleTrigger("cleanup-stale")}>
                <Trash2 className="h-3 w-3" /> Cleanup Stale
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={!!triggeringSource} onClick={() => handleTrigger("match-all-users")}>
                <Globe className="h-3 w-3" /> Match All
              </Button>
            </div>
          </div>
        </div>

        {/* API Quotas + Active Locks */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
              API Quotas
            </h2>
            <div className="space-y-3">
              {Object.entries(stats.quotas).map(([name, q]) => {
                const pct = Math.min(Math.round((q.used / q.limit) * 100), 100);
                const isWarning = pct >= 80;
                const isDanger = pct >= 95;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600 dark:text-zinc-300 capitalize">{name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {q.used.toLocaleString()} / {q.limit.toLocaleString()} <span className="text-slate-300 dark:text-zinc-600">/{q.period}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isDanger ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Locks */}
          {runningLocks.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 ring-1 ring-amber-100/80 dark:ring-amber-800/40">
              <h2 className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Active System Locks
              </h2>
              <div className="space-y-1.5">
                {runningLocks.map((lock) => (
                  <div key={lock.name} className="flex items-center gap-2 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="font-medium text-amber-900 dark:text-amber-100">{lock.name}</span>
                    {lock.startedAt && (
                      <span className="text-amber-600 dark:text-amber-400">
                        started {timeAgo(lock.startedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Errors */}
      {stats.recentErrors.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
          <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Recent Errors (24h)
            <span className="text-[10px] font-normal text-red-400 ml-auto">{stats.recentErrors.length} errors</span>
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {stats.recentErrors.map((err, i) => (
              <div key={i} className="rounded-lg bg-red-50/50 dark:bg-red-900/20 p-3 ring-1 ring-red-100/50 dark:ring-red-800/40">
                <div className="flex items-center gap-2 text-[10px] text-red-400 mb-1">
                  {err.source && <span className="font-semibold capitalize">{err.source}</span>}
                  <span>{timeAgo(err.createdAt)}</span>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300 break-words">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
      <div className="flex items-center gap-1.5 mb-1">{icon}</div>
      <div className="text-lg font-bold text-slate-800 dark:text-zinc-100 tabular-nums leading-tight">
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-zinc-400">{label}</div>
      {sub && <div className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
