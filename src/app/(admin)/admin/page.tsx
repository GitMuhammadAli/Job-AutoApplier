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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AdminStats {
  userCount: number;
  globalJobCount: number;
  applicationCount: number;
  sentToday: number;
  failedToday: number;
  scraperHealth: {
    source: string;
    lastRun: string | null;
    jobsFound: number;
    errors: number;
  }[];
  recentErrors: { message: string; createdAt: string; source: string | null }[];
  quotas: { name: string; used: number; limit: string }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringScrape, setTriggeringScrape] = useState(false);

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

  async function handleForceScrape() {
    setTriggeringScrape(true);
    try {
      const res = await fetch("/api/admin/scrapers/trigger", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Scrape triggered: ${data.newJobs ?? 0} new jobs`);
        fetchStats();
      } else {
        toast.error(data.error || "Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger scrape");
    }
    setTriggeringScrape(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">System overview and controls</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchStats}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleForceScrape}
            disabled={triggeringScrape}
            className="gap-1.5"
          >
            {triggeringScrape ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Force Scrape
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Users className="h-4 w-4 text-blue-600" />} label="Users" value={stats.userCount} bg="bg-blue-50" />
        <StatCard icon={<Briefcase className="h-4 w-4 text-violet-600" />} label="Global Jobs" value={stats.globalJobCount} bg="bg-violet-50" />
        <StatCard icon={<Send className="h-4 w-4 text-emerald-600" />} label="Sent Today" value={stats.sentToday} bg="bg-emerald-50" />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="Failed Today" value={stats.failedToday} bg="bg-red-50" />
      </div>

      {/* Scraper Health */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100/80">
        <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          Scraper Health
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="py-2 pr-4 text-left font-semibold">Source</th>
                <th className="py-2 px-4 text-left font-semibold">Last Run</th>
                <th className="py-2 px-4 text-right font-semibold">Jobs Found</th>
                <th className="py-2 pl-4 text-right font-semibold">Errors</th>
              </tr>
            </thead>
            <tbody>
              {stats.scraperHealth.map((s) => (
                <tr key={s.source} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700 capitalize">{s.source}</td>
                  <td className="py-2 px-4 text-slate-500">
                    {s.lastRun ? new Date(s.lastRun).toLocaleString() : "Never"}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-slate-700">{s.jobsFound}</td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    <span className={s.errors > 0 ? "text-red-600 font-medium" : "text-slate-400"}>
                      {s.errors}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Quotas */}
      {stats.quotas.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100/80">
          <h2 className="text-sm font-bold text-slate-800 mb-3">API Quotas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.quotas.map((q) => (
              <div key={q.name} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                <div className="text-[11px] font-medium text-slate-500">{q.name}</div>
                <div className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">
                  {q.used} / {q.limit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {stats.recentErrors.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100/80">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Recent Errors (24h)
          </h2>
          <div className="space-y-2">
            {stats.recentErrors.map((err, i) => (
              <div key={i} className="rounded-lg bg-red-50/50 p-3 ring-1 ring-red-100/50">
                <div className="flex items-center gap-2 text-[10px] text-red-400 mb-1">
                  {err.source && <span className="font-medium">{err.source}</span>}
                  <span>{new Date(err.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-red-700">{err.message}</p>
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
    <div className={`rounded-xl ${bg} p-4 ring-1 ring-slate-100/50`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <div className="text-lg font-bold text-slate-800 tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
