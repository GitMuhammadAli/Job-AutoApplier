"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Globe,
  Timer,
  Play,
  Mail,
  Bell,
  MessageSquare,
  Trash2,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScraperInfo {
  source: string;
  lastRun: string | null;
  lastMessage: string | null;
  jobCount: number;
  updatedCount: number;
  totalJobs: number;
  isHealthy: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
}

interface CronInfo {
  key: string;
  label: string;
  category: string;
  lastRun: string | null;
  lastMessage: string | null;
  lastStatus: string | null;
  lastDurationMs: number | null;
  lastProcessed: number | null;
  lastFailed: number | null;
  avgDurationMs: number | null;
  recentFailures: number;
  isRunning: boolean;
  startedAt: string | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  scraper: { label: "Scrapers", icon: Search, color: "blue" },
  matching: { label: "Matching", icon: Users, color: "violet" },
  application: { label: "Applications", icon: Mail, color: "emerald" },
  notification: { label: "Notifications", icon: Bell, color: "amber" },
  followup: { label: "Follow-ups", icon: MessageSquare, color: "cyan" },
  maintenance: { label: "Maintenance", icon: Trash2, color: "slate" },
};

export default function AdminScrapersPage() {
  const [scrapers, setScrapers] = useState<ScraperInfo[]>([]);
  const [crons, setCrons] = useState<CronInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScrapers(data.scrapers || []);
      setCrons(data.crons || []);
    } catch {
      toast.error("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        toast.success(`Triggered ${source}: ${data.results ? `${data.results.length} sources` : JSON.stringify(data).slice(0, 60)}`);
        setTimeout(fetchData, 5000);
      } else {
        toast.error(data.error || "Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger");
    }
    setTriggeringSource(null);
  }

  const healthyScrapers = scrapers.filter((s) => s.isHealthy).length;
  const totalJobs = scrapers.reduce((sum, s) => sum + s.totalJobs, 0);
  const healthyCrons = crons.filter((c) => c.lastStatus === "success" || c.lastStatus === "skipped").length;
  const runningCrons = crons.filter((c) => c.isRunning).length;

  // Group crons by category
  const cronsByCategory = crons.reduce<Record<string, CronInfo[]>>((acc, c) => {
    const cat = c.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  if (loading && scrapers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Cron System</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {healthyCrons}/{crons.length} crons healthy &middot; {healthyScrapers}/{scrapers.length} scrapers healthy &middot; {totalJobs.toLocaleString()} active jobs
            {runningCrons > 0 && <span className="text-amber-500"> &middot; {runningCrons} running</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleTrigger("all")} disabled={!!triggeringSource} className="gap-1.5">
            {triggeringSource === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Scrape All
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTrigger("scrape-global")} disabled={!!triggeringSource} className="gap-1.5">
            {triggeringSource === "scrape-global" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            Global Scrape
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={CheckCircle2} value={healthyCrons} label="Crons OK" color="emerald" />
        <SummaryCard icon={XCircle} value={crons.length - healthyCrons} label="Crons Failing" color="red" />
        <SummaryCard icon={Database} value={totalJobs.toLocaleString()} label="Active Jobs" color="blue" />
        <SummaryCard icon={BarChart3} value={crons.length} label="Total Crons" color="violet" />
      </div>

      {/* Scraper Source Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
          <Search className="h-4 w-4" /> Job Sources ({scrapers.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {scrapers.map((s) => (
            <div
              key={s.source}
              className={`rounded-xl bg-white dark:bg-zinc-800 p-3 shadow-sm ring-1 transition-colors ${
                s.isHealthy ? "ring-slate-100/80 dark:ring-zinc-700/60" : "ring-red-200/80 dark:ring-red-800/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-100 capitalize">{s.source}</h3>
                <StatusBadge healthy={s.isHealthy} />
              </div>
              <div className="space-y-1 text-[10px] mb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400"><Clock className="h-2.5 w-2.5 inline mr-0.5" />Last</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-medium">{s.lastRun ? timeAgo(s.lastRun) : "Never"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400"><TrendingUp className="h-2.5 w-2.5 inline mr-0.5" />New</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-medium tabular-nums">{s.jobCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400"><Database className="h-2.5 w-2.5 inline mr-0.5" />Total</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-bold tabular-nums">{s.totalJobs.toLocaleString()}</span>
                </div>
              </div>
              {s.lastError && !s.isHealthy && (
                <div className="rounded bg-red-50 dark:bg-red-900/20 p-1.5 text-[9px] text-red-600 dark:text-red-300 truncate mb-2">
                  <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />{s.lastError}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1 text-[10px] h-7"
                disabled={!!triggeringSource}
                onClick={() => handleTrigger(s.source)}
              >
                {triggeringSource === s.source ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
                {triggeringSource === s.source ? "Running..." : "Trigger"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Cron Jobs by Category */}
      {Object.entries(CATEGORY_CONFIG).map(([catKey, catConfig]) => {
        const catCrons = cronsByCategory[catKey];
        if (!catCrons || catCrons.length === 0) return null;
        const CatIcon = catConfig.icon;
        return (
          <div key={catKey}>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
              <CatIcon className="h-4 w-4" /> {catConfig.label} ({catCrons.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catCrons.map((c) => (
                <CronCard key={c.key} cron={c} triggeringSource={triggeringSource} onTrigger={handleTrigger} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ icon: Icon, value, label, color }: { icon: typeof CheckCircle2; value: string | number; label: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-100/50 dark:ring-emerald-800/40 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-900/20 ring-red-100/50 dark:ring-red-800/40 text-red-600 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 ring-blue-100/50 dark:ring-blue-800/40 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-50 dark:bg-violet-900/20 ring-violet-100/50 dark:ring-violet-800/40 text-violet-600 dark:text-violet-400",
  };
  const textColors: Record<string, string> = {
    emerald: "text-emerald-800 dark:text-emerald-200",
    red: "text-red-800 dark:text-red-200",
    blue: "text-blue-800 dark:text-blue-200",
    violet: "text-violet-800 dark:text-violet-200",
  };
  return (
    <div className={`rounded-xl p-3 ring-1 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1"><Icon className="h-4 w-4" /></div>
      <div className={`text-lg font-bold tabular-nums ${textColors[color]}`}>{value}</div>
      <div className="text-[10px]">{label}</div>
    </div>
  );
}

function StatusBadge({ healthy }: { healthy: boolean }) {
  return healthy ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="h-2.5 w-2.5" /> OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:text-red-300">
      <XCircle className="h-2.5 w-2.5" /> Err
    </span>
  );
}

function CronCard({ cron: c, triggeringSource, onTrigger }: { cron: CronInfo; triggeringSource: string | null; onTrigger: (s: string) => void }) {
  const isOk = c.lastStatus === "success" || c.lastStatus === "skipped";
  const isError = c.lastStatus === "error";
  const isStale = !c.lastRun;
  const triggerId = c.key.startsWith("scrape-") && c.key !== "scrape-global"
    ? c.key.replace("scrape-", "")
    : c.key;

  return (
    <div className={`rounded-xl bg-white dark:bg-zinc-800 p-3 shadow-sm ring-1 transition-colors ${
      isError ? "ring-red-200/80 dark:ring-red-800/40" : isStale ? "ring-amber-200/80 dark:ring-amber-800/40" : "ring-slate-100/80 dark:ring-zinc-700/60"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-100">{c.label}</h3>
        <div className="flex items-center gap-1">
          {c.isRunning && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
              <Play className="h-2.5 w-2.5" /> Running
            </span>
          )}
          {isOk && !c.isRunning && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-2.5 w-2.5" /> {c.lastStatus === "skipped" ? "Skip" : "OK"}
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:text-red-300">
              <XCircle className="h-2.5 w-2.5" /> Err
            </span>
          )}
          {isStale && !c.isRunning && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-zinc-400">
              <Clock className="h-2.5 w-2.5" /> Never
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 text-[10px] mb-2">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-zinc-400"><Clock className="h-2.5 w-2.5 inline mr-0.5" />Last run</span>
          <span className="text-slate-700 dark:text-zinc-200 font-medium">{c.lastRun ? timeAgo(c.lastRun) : "Never"}</span>
        </div>
        {c.lastDurationMs != null && (
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-zinc-400"><Timer className="h-2.5 w-2.5 inline mr-0.5" />Duration</span>
            <span className="text-slate-700 dark:text-zinc-200 font-medium tabular-nums">{formatDuration(c.lastDurationMs)}</span>
          </div>
        )}
        {c.lastProcessed != null && (
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-zinc-400"><TrendingUp className="h-2.5 w-2.5 inline mr-0.5" />Processed</span>
            <span className="text-slate-700 dark:text-zinc-200 font-medium tabular-nums">
              {c.lastProcessed}{c.lastFailed ? ` (${c.lastFailed} failed)` : ""}
            </span>
          </div>
        )}
        {c.avgDurationMs != null && (
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-zinc-400"><BarChart3 className="h-2.5 w-2.5 inline mr-0.5" />Avg</span>
            <span className="text-slate-700 dark:text-zinc-200 font-medium tabular-nums">{formatDuration(c.avgDurationMs)}</span>
          </div>
        )}
        {c.recentFailures > 0 && (
          <div className="flex justify-between">
            <span className="text-red-500 dark:text-red-400"><AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />Recent errors</span>
            <span className="text-red-600 dark:text-red-300 font-bold tabular-nums">{c.recentFailures}/5</span>
          </div>
        )}
      </div>

      {c.lastMessage && (
        <div className="rounded bg-slate-50 dark:bg-zinc-700/50 p-1.5 text-[9px] text-slate-500 dark:text-zinc-400 truncate mb-2" title={c.lastMessage}>
          {c.lastMessage}
        </div>
      )}

      <Button
        size="sm"
        variant={isError ? "default" : "outline"}
        className="w-full gap-1 text-[10px] h-7"
        disabled={!!triggeringSource || c.isRunning}
        onClick={() => onTrigger(triggerId)}
      >
        {triggeringSource === triggerId ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
        {triggeringSource === triggerId ? "Running..." : c.isRunning ? "In Progress" : "Trigger"}
      </Button>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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
