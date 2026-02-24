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

export default function AdminScrapersPage() {
  const [scrapers, setScrapers] = useState<ScraperInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);

  const fetchScrapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScrapers(data.scrapers || []);
    } catch {
      toast.error("Failed to load scrapers");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchScrapers(); }, [fetchScrapers]);

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
        setTimeout(fetchScrapers, 5000);
      } else {
        toast.error(data.error || "Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger");
    }
    setTriggeringSource(null);
  }

  const healthyCount = scrapers.filter((s) => s.isHealthy).length;
  const totalJobs = scrapers.reduce((sum, s) => sum + s.totalJobs, 0);

  if (loading && scrapers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Scrapers</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {healthyCount}/{scrapers.length} healthy &middot; {totalJobs.toLocaleString()} total active jobs
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchScrapers} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleTrigger("all")} disabled={!!triggeringSource} className="gap-1.5">
            {triggeringSource === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Trigger All ({scrapers.length})
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTrigger("scrape-global")} disabled={!!triggeringSource} className="gap-1.5">
            {triggeringSource === "scrape-global" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            Scrape Global
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 ring-1 ring-emerald-100/50 dark:ring-emerald-800/40">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">{healthyCount}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Healthy</div>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 ring-1 ring-red-100/50 dark:ring-red-800/40">
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
            <XCircle className="h-4 w-4" />
          </div>
          <div className="text-lg font-bold text-red-800 dark:text-red-200 tabular-nums">{scrapers.length - healthyCount}</div>
          <div className="text-[10px] text-red-600 dark:text-red-400">Unhealthy</div>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 ring-1 ring-blue-100/50 dark:ring-blue-800/40">
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
            <Database className="h-4 w-4" />
          </div>
          <div className="text-lg font-bold text-blue-800 dark:text-blue-200 tabular-nums">{totalJobs.toLocaleString()}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400">Total Jobs</div>
        </div>
        <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-3 ring-1 ring-violet-100/50 dark:ring-violet-800/40">
          <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 mb-1">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="text-lg font-bold text-violet-800 dark:text-violet-200 tabular-nums">{scrapers.length}</div>
          <div className="text-[10px] text-violet-600 dark:text-violet-400">Sources</div>
        </div>
      </div>

      {/* Scraper Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scrapers.map((s) => (
          <div
            key={s.source}
            className={`rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm ring-1 transition-colors ${
              s.isHealthy
                ? "ring-slate-100/80 dark:ring-zinc-700/60"
                : "ring-red-200/80 dark:ring-red-800/40"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 capitalize">{s.source}</h3>
              {s.isHealthy ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Healthy
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                  <XCircle className="h-3 w-3" /> Error
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="space-y-2 text-[11px] mb-3">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Last run</span>
                <span className="text-slate-700 dark:text-zinc-200 font-medium">
                  {s.lastRun ? timeAgo(s.lastRun) : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Last scrape</span>
                <span className="text-slate-700 dark:text-zinc-200 font-medium tabular-nums">
                  {s.jobCount > 0 ? `${s.jobCount} new` : "0 new"}
                  {s.updatedCount > 0 && `, ${s.updatedCount} updated`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1"><Database className="h-3 w-3" /> Total active</span>
                <span className="text-slate-700 dark:text-zinc-200 font-bold tabular-nums">{s.totalJobs.toLocaleString()}</span>
              </div>
            </div>

            {/* Last message */}
            {s.lastMessage && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-700/50 p-2 text-[10px] text-slate-500 dark:text-zinc-400 truncate mb-3">
                {s.lastMessage}
              </div>
            )}

            {/* Error */}
            {s.lastError && !s.isHealthy && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2 text-[10px] text-red-600 dark:text-red-300 mb-3">
                <div className="flex items-center gap-1 mb-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-semibold">Error</span>
                  {s.lastErrorAt && <span className="text-red-400 ml-auto">{timeAgo(s.lastErrorAt)}</span>}
                </div>
                <p className="truncate">{s.lastError}</p>
              </div>
            )}

            {/* Trigger Button */}
            <Button
              size="sm"
              variant={s.isHealthy ? "outline" : "default"}
              className="w-full gap-1.5 text-xs"
              disabled={!!triggeringSource}
              onClick={() => handleTrigger(s.source)}
            >
              {triggeringSource === s.source ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {triggeringSource === s.source ? "Running..." : "Trigger Scrape"}
            </Button>
          </div>
        ))}
      </div>
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
