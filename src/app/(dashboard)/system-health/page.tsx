"use client";

import { useState, useEffect } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HealthData {
  status: string;
  lastScrape: { time: string; message: string } | null;
  lastInstantApply: { time: string; message: string } | null;
  today: { sent: number; failed: number; bounced: number; drafted: number };
  sourceStats: Record<string, { found: number; errors: number }>;
  locks: { name: string; isRunning: boolean; startedAt: string | null; completedAt: string | null }[];
  recentErrors: { source: string | null; message: string; time: string }[];
}

export default function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-health");
      if (res.ok) setData(await res.json());
    } catch {
      toast.error("Failed to load system health");
    }
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  const handleExport = () => {
    window.open("/api/export", "_blank");
    toast.success("Export started");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-slate-500 dark:text-zinc-400">
        Failed to load system health. Make sure you are logged in.
      </div>
    );
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-zinc-200">System Health</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            data.status === "healthy" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
          }`}>
            {data.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchHealth}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export Data
          </Button>
        </div>
      </div>

      {/* Cron Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatusCard
          title="Last Scrape"
          time={data.lastScrape?.time}
          message={data.lastScrape?.message || "No scrapes yet"}
          timeAgo={data.lastScrape ? timeAgo(data.lastScrape.time) : "Never"}
        />
        <StatusCard
          title="Last Instant-Apply"
          time={data.lastInstantApply?.time}
          message={data.lastInstantApply?.message || "No instant-apply runs yet"}
          timeAgo={data.lastInstantApply ? timeAgo(data.lastInstantApply.time) : "Never"}
        />
      </div>

      {/* Today's Stats */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100 dark:ring-zinc-700/50">
        <h2 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">Today&apos;s Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox label="Sent" value={data.today.sent} color="text-emerald-600" />
          <StatBox label="Drafted" value={data.today.drafted} color="text-blue-600" />
          <StatBox label="Failed" value={data.today.failed} color="text-red-600" />
          <StatBox label="Bounced" value={data.today.bounced} color="text-amber-600" />
        </div>
      </div>

      {/* Source Stats */}
      {Object.keys(data.sourceStats).length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100 dark:ring-zinc-700/50">
          <h2 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">Source Performance (Today)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(data.sourceStats).map(([source, stats]) => (
              <div key={source} className="rounded-lg bg-slate-50 dark:bg-zinc-700/50 p-3">
                <div className="text-xs font-semibold text-slate-600 dark:text-zinc-400 capitalize">{source}</div>
                <div className="text-lg font-bold text-slate-800 dark:text-zinc-200 tabular-nums">{stats.found}</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                  {stats.errors > 0 ? (
                    <span className="text-red-500">{stats.errors} errors</span>
                  ) : (
                    "No errors"
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locks */}
      {data.locks.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100 dark:ring-zinc-700/50">
          <h2 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">Active Locks</h2>
          <div className="space-y-2">
            {data.locks.map((lock) => (
              <div key={lock.name} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-zinc-700/50 px-3 py-2">
                <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">{lock.name}</span>
                <span className={`text-xs font-semibold ${lock.isRunning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {lock.isRunning ? "Running" : "Idle"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {data.recentErrors.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-red-100 dark:ring-red-900/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-bold text-red-700 dark:text-red-300">Recent Errors</h2>
          </div>
          <div className="space-y-2">
            {data.recentErrors.map((err, i) => (
              <div key={i} className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-red-700 dark:text-red-300">{err.source || "system"}</span>
                  <span className="text-red-400 dark:text-red-400">{timeAgo(err.time)}</span>
                </div>
                <p className="text-red-600 dark:text-red-400 mt-0.5 truncate">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ title, message, timeAgo: ago }: {
  title: string;
  time?: string | null;
  message: string;
  timeAgo: string;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100 dark:ring-zinc-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">{title}</span>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500">
          <Clock className="h-3 w-3" />
          {ago}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{message}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{label}</div>
    </div>
  );
}
