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
  Circle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ActiveUser {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  lastActive: string | null;
  isOnline: boolean;
  status: string;
  mode: string;
  joinedAt: string;
}

interface AdminStats {
  users: { total: number; active: number; paused: number; neverOnboarded: number };
  jobs: { active: number; inactive: number; fresh: number; sourceDistribution: Record<string, number> };
  applicationsToday: { sent: number; failed: number; bounced: number };
  applicationPipeline: { draft: number; ready: number; sending: number; sentTotal: number; sentThisWeek: number };
  quality: { overallEmailRate: number; deliveryRate: number; totalBounced: number; totalSent: number; totalFailed: number };
  scrapers: {
    source: string;
    lastRun: string | null;
    lastMessage: string | null;
    jobCount: number;
    updatedCount: number;
    totalJobs: number;
    withEmail: number;
    withSkills: number;
    emailRate: number;
    skillRate: number;
    topSkills: { name: string; count: number }[];
    topCategories: { name: string; count: number }[];
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
  recentlyActiveUsers: ActiveUser[];
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
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="text-xs text-slate-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle className="h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">Failed to load admin stats</p>
        <Button size="sm" variant="outline" onClick={fetchStats}
          className="gap-1.5 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]">
          <RefreshCw className="h-3.5 w-3.5" />Retry
        </Button>
      </div>
    );
  }

  const healthyScrapers = stats.scrapers.filter((s) => s.isHealthy).length;
  const runningLocks = stats.locks.filter((l) => l.isRunning);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">Dashboard</h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            System overview &middot; {healthyScrapers}/{stats.scrapers.length} scrapers healthy
            {runningLocks.length > 0 && (
              <span className="text-amber-400 ml-2">
                &middot; {runningLocks.length} lock{runningLocks.length > 1 ? "s" : ""} active
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={fetchStats} disabled={loading}
            className="gap-1.5 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleTrigger("all")} disabled={!!triggeringSource}
            className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/20">
            {triggeringSource === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Scrape All
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTrigger("instant-apply")} disabled={!!triggeringSource}
            className="gap-1.5 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
            {triggeringSource === "instant-apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Instant Apply
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard icon={Users} label="Users" value={stats.users.total} sub={`${stats.users.active} active`} accent="blue" />
        <KpiCard icon={Briefcase} label="Active Jobs" value={stats.jobs.active} sub={`${stats.jobs.fresh} fresh`} accent="violet" />
        <KpiCard icon={FileText} label="Drafts" value={stats.applicationPipeline.draft} accent="amber" />
        <KpiCard icon={Clock} label="Ready" value={stats.applicationPipeline.ready} accent="cyan" />
        <KpiCard icon={Send} label="Sent Today" value={stats.applicationsToday.sent} sub={`${stats.applicationPipeline.sentThisWeek} /wk`} accent="emerald" />
        <KpiCard icon={AlertTriangle} label="Failed" value={stats.applicationsToday.failed} accent="red" />
        <KpiCard icon={Ban} label="Bounced" value={stats.applicationsToday.bounced} accent="orange" />
        <KpiCard icon={TrendingUp} label="Total Sent" value={stats.applicationPipeline.sentTotal} accent="emerald" />
      </div>

      {/* Scraper Quality */}
      <div className="rounded-xl p-5 ring-1 ring-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Scraper Quality & Email Coverage</h2>
          <span className="ml-auto text-[10px] text-slate-500">
            {stats.quality.overallEmailRate}% email &middot; {stats.quality.deliveryRate}% delivery
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {[
            { label: "Email Coverage", value: `${stats.quality.overallEmailRate}%`, accent: "blue" },
            { label: "Delivery Rate", value: `${stats.quality.deliveryRate}%`, accent: "emerald" },
            { label: "Delivered", value: String(stats.quality.totalSent), accent: "violet" },
            { label: "Bounced", value: String(stats.quality.totalBounced), accent: "orange" },
            { label: "Failed", value: String(stats.quality.totalFailed), accent: "red" },
          ].map((m) => (
            <div key={m.label} className={`rounded-lg p-3 text-center ring-1 ring-white/[0.04] bg-white/[0.02]`}>
              <div className={`text-lg font-bold tabular-nums text-${m.accent === "orange" ? "orange" : m.accent}-400`}>{m.value}</div>
              <div className="text-[10px] text-slate-500">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Source", "Total", "Has Email", "Email %", "Has Skills", "Top Skills", "Categories"].map((h) => (
                  <th key={h} className={`py-2 px-2 font-semibold text-slate-500 ${h === "Source" || h === "Top Skills" || h === "Categories" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {stats.scrapers.sort((a, b) => b.totalJobs - a.totalJobs).map((s) => (
                <tr key={s.source} className="hover:bg-white/[0.02]">
                  <td className="py-2 px-2 font-bold text-slate-200 capitalize">{s.source}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-400">{s.totalJobs.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-400">{s.withEmail.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${
                      s.emailRate >= 20 ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20"
                        : s.emailRate >= 5 ? "text-amber-400 bg-amber-500/10 ring-amber-500/20"
                        : "text-red-400 bg-red-500/10 ring-red-500/20"
                    }`}>{s.emailRate}%</span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-400">{s.skillRate}%</td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {s.topSkills.slice(0, 4).map((sk) => (
                        <span key={sk.name} className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] text-slate-400">{sk.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {s.topCategories.slice(0, 3).map((cat) => (
                        <span key={cat.name} className="rounded bg-blue-500/10 px-1 py-0.5 text-[9px] text-blue-400">{cat.name}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Users */}
      {stats.recentlyActiveUsers && stats.recentlyActiveUsers.length > 0 && (
        <div className="rounded-xl p-5 ring-1 ring-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-slate-400" />
            <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Active Users</h2>
            <span className="text-[10px] text-emerald-400 ml-auto">
              {stats.recentlyActiveUsers.filter(u => u.isOnline).length} online
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.recentlyActiveUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/[0.03] transition-colors">
                <div className="relative flex-shrink-0">
                  {user.image ? (
                    <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-400 ring-1 ring-white/10">
                      {(user.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0e14] ${
                    user.isOnline ? "bg-emerald-400" : "bg-slate-600"
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200 truncate">{user.name}</span>
                    <span className={`rounded-full px-1.5 py-0 text-[8px] font-bold leading-4 ring-1 ${
                      user.status === "active"
                        ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20"
                        : "text-amber-400 bg-amber-500/10 ring-amber-500/20"
                    }`}>{user.mode}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {user.isOnline ? <span className="text-emerald-400 font-medium">Online</span> : (user.lastActive ? timeAgo(user.lastActive) : "Never")}
                    {" · "}joined {timeAgo(user.joinedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scraper Health */}
        <div className="rounded-xl p-5 ring-1 ring-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-slate-400" />
            <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Scraper Health</h2>
            <span className="text-[10px] text-slate-500 ml-auto">{healthyScrapers}/{stats.scrapers.length}</span>
          </div>
          <div className="space-y-1.5">
            {stats.scrapers.map((s) => (
              <div key={s.source} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/[0.03] transition-colors">
                <Circle className={`h-2 w-2 shrink-0 fill-current ${s.isHealthy ? "text-emerald-400" : "text-red-400"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 capitalize">{s.source}</span>
                    <span className="text-[10px] text-slate-600 tabular-nums">{s.totalJobs.toLocaleString()} jobs</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {s.lastRun ? timeAgo(s.lastRun) : "Never"}
                    {s.lastMessage && ` · ${s.lastMessage}`}
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={!!triggeringSource} onClick={() => handleTrigger(s.source)}
                  className="h-7 px-2 text-slate-500 hover:text-white hover:bg-white/[0.06]">
                  {triggeringSource === s.source ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs by Source */}
        <div className="rounded-xl p-5 ring-1 ring-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Jobs by Source</h2>
            <span className="text-[10px] text-slate-500 ml-auto">{stats.jobs.active.toLocaleString()} total</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(stats.jobs.sourceDistribution).sort((a, b) => b[1] - a[1]).map(([source, count]) => {
              const pct = Math.round((count / Math.max(stats.jobs.active, 1)) * 100);
              return (
                <div key={source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300 capitalize">{source}</span>
                    <span className="text-slate-500 tabular-nums">{count.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-blue-500/60 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Crons & Actions */}
        <div className="rounded-xl p-5 ring-1 ring-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-slate-400" />
            <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Cron Jobs & Actions</h2>
          </div>
          <div className="space-y-1">
            {stats.crons.map((cron) => (
              <div key={cron.key} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.03] transition-colors">
                <Circle className={`h-2 w-2 shrink-0 fill-current ${cron.isRunning ? "text-amber-400 animate-pulse" : "text-slate-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-300">{cron.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {cron.isRunning ? `Running since ${cron.startedAt ? timeAgo(cron.startedAt) : "unknown"}` : cron.lastRun ? `Last: ${timeAgo(cron.lastRun)}` : "Never run"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={!!triggeringSource || cron.isRunning} onClick={() => handleTrigger(cron.key)}
                  className="h-7 px-2 text-slate-500 hover:text-white hover:bg-white/[0.06]">
                  {triggeringSource === cron.key ? <Loader2 className="h-3 w-3 animate-spin" /> : cron.isRunning ? <Activity className="h-3 w-3 text-amber-400" /> : <Play className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "send-scheduled", label: "Send Scheduled", icon: Mail },
                { id: "send-queued", label: "Send Queued", icon: Send },
                { id: "cleanup-stale", label: "Cleanup Stale", icon: Trash2 },
                { id: "match-all-users", label: "Match All", icon: Globe },
              ].map((a) => (
                <Button key={a.id} size="sm" variant="outline" disabled={!!triggeringSource} onClick={() => handleTrigger(a.id)}
                  className="h-7 text-[11px] gap-1 border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:text-white">
                  <a.icon className="h-3 w-3" /> {a.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Database</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "clear-inactive", label: "Clear Inactive", action: "clear-inactive", color: "red" },
                { id: "clear-old", label: "Deactivate Stale (>14d)", action: "clear-old", color: "amber" },
                { id: "clear-no-email", label: "Deactivate No-Email (>7d)", action: "clear-no-email", color: "slate" },
              ].map((a) => (
                <Button key={a.id} size="sm" variant="outline" disabled={!!triggeringSource}
                  className={`h-7 text-[11px] gap-1 border-white/10 ${
                    a.color === "red" ? "text-red-400 hover:bg-red-500/10" : a.color === "amber" ? "text-amber-400 hover:bg-amber-500/10" : "text-slate-400 hover:bg-white/[0.08]"
                  } bg-white/[0.03]`}
                  onClick={async () => {
                    setTriggeringSource(a.id);
                    try {
                      const res = await fetch("/api/admin/jobs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a.action, ...(a.action === "clear-old" ? { olderThanDays: 14 } : {}) }) });
                      const data = await res.json();
                      toast.success(data.message || `Cleaned ${data.count} jobs`);
                      setTimeout(fetchStats, 2000);
                    } catch { toast.error("Failed"); }
                    setTriggeringSource(null);
                  }}>
                  <Trash2 className="h-3 w-3" /> {a.label}
                </Button>
              ))}
              <Button size="sm" variant="outline" disabled={!!triggeringSource}
                className="h-7 text-[11px] gap-1 border-white/10 text-orange-400 hover:bg-orange-500/10 bg-white/[0.03]"
                onClick={async () => {
                  setTriggeringSource("cleanup-emails");
                  try {
                    const res = await fetch("/api/admin/cleanup-emails", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`Cleaned ${data.globalJobsEmailsCleared} guessed GlobalJob emails, ${data.draftEmailsCleared} draft recipients, ${data.readyDowngradedToDraft} READY→DRAFT`);
                    } else {
                      toast.error(data.error || "Failed");
                    }
                    setTimeout(fetchStats, 2000);
                  } catch { toast.error("Failed"); }
                  setTriggeringSource(null);
                }}>
                <Mail className="h-3 w-3" /> Cleanup Guessed Emails
              </Button>
            </div>
          </div>
        </div>

        {/* Quotas + Locks */}
        <div className="space-y-4">
          <div className="rounded-xl p-5 ring-1 ring-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-slate-400" />
              <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">API Quotas</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(stats.quotas).map(([name, q]) => {
                const pct = Math.min(Math.round((q.used / q.limit) * 100), 100);
                const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-blue-500";
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-400 capitalize">{name}</span>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {q.used.toLocaleString()} / {q.limit.toLocaleString()} <span className="text-slate-600">/{q.period}</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {runningLocks.length > 0 && (
            <div className="rounded-xl p-4 ring-1 ring-amber-500/20 bg-amber-500/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <h2 className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Active Locks</h2>
              </div>
              <div className="space-y-1.5">
                {runningLocks.map((lock) => (
                  <div key={lock.name} className="flex items-center gap-2 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-medium text-amber-200">{lock.name}</span>
                    {lock.startedAt && <span className="text-amber-400/70">started {timeAgo(lock.startedAt)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Errors */}
      {stats.recentErrors.length > 0 && (
        <div className="rounded-xl p-5 ring-1 ring-red-500/15 bg-red-500/[0.03]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Errors (24h)</h2>
            <span className="text-[10px] text-red-400 font-bold ml-auto tabular-nums">{stats.recentErrors.length}</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {stats.recentErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] rounded-lg p-2 hover:bg-white/[0.02]">
                <ChevronRight className="h-3 w-3 text-red-500/50 shrink-0 mt-0.5" />
                <span className="text-slate-600 shrink-0 tabular-nums w-14">{timeAgo(err.createdAt)}</span>
                {err.source && <span className="text-amber-400 font-semibold capitalize shrink-0 w-16 truncate">{err.source}</span>}
                <p className="text-slate-400 break-words">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: number; sub?: string; accent: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400", violet: "text-violet-400", amber: "text-amber-400", cyan: "text-cyan-400",
    emerald: "text-emerald-400", red: "text-red-400", orange: "text-orange-400",
  };
  return (
    <div className="rounded-xl p-3 ring-1 ring-white/[0.06] bg-white/[0.02]">
      <Icon className={`h-3.5 w-3.5 ${colors[accent] || "text-slate-400"} mb-1`} />
      <div className="text-lg font-bold text-white tabular-nums leading-tight">{value.toLocaleString()}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
      {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
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
