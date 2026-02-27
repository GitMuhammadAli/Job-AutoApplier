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
  Activity,
  Circle,
  ChevronRight,
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

interface StatsData {
  users: { total: number; active: number; paused: number; neverOnboarded: number };
  jobs: { active: number; inactive: number; fresh: number; sourceDistribution: Record<string, number> };
  applicationsToday: { sent: number; failed: number; bounced: number };
  applicationPipeline: { draft: number; ready: number; sending: number; sentTotal: number; sentThisWeek: number };
  quality: { overallEmailRate: number; deliveryRate: number; totalBounced: number; totalSent: number; totalFailed: number };
  quotas: Record<string, { used: number; limit: number; period: string }>;
  recentErrors: { message: string; createdAt: string; source: string }[];
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Globe; accent: string }> = {
  scraper: { label: "Scrapers", icon: Search, accent: "blue" },
  matching: { label: "Matching", icon: Users, accent: "violet" },
  application: { label: "Applications", icon: Mail, accent: "emerald" },
  notification: { label: "Notifications", icon: Bell, accent: "amber" },
  followup: { label: "Follow-ups", icon: MessageSquare, accent: "cyan" },
  maintenance: { label: "Maintenance", icon: Trash2, accent: "slate" },
};

export default function AdminScrapersPage() {
  const [scrapers, setScrapers] = useState<ScraperInfo[]>([]);
  const [crons, setCrons] = useState<CronInfo[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
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
      setStats({
        users: data.users,
        jobs: data.jobs,
        applicationsToday: data.applicationsToday,
        applicationPipeline: data.applicationPipeline,
        quality: data.quality,
        quotas: data.quotas,
        recentErrors: data.recentErrors || [],
      });
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
        toast.success(`Triggered ${source}`);
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

  const cronsByCategory = crons.reduce<Record<string, CronInfo[]>>((acc, c) => {
    const cat = c.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  if (loading && scrapers.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="text-xs text-slate-500">Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">System Monitoring</h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Circle className={`h-1.5 w-1.5 fill-current ${healthyCrons > crons.length / 2 ? "text-emerald-400" : "text-red-400"}`} />
              {healthyCrons}/{crons.length} crons
            </span>
            <span className="text-slate-700">/</span>
            <span className="flex items-center gap-1">
              <Circle className={`h-1.5 w-1.5 fill-current ${healthyScrapers > scrapers.length / 2 ? "text-emerald-400" : "text-amber-400"}`} />
              {healthyScrapers}/{scrapers.length} scrapers
            </span>
            <span className="text-slate-700">/</span>
            <span>{totalJobs.toLocaleString()} jobs</span>
            {runningCrons > 0 && (
              <>
                <span className="text-slate-700">/</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {runningCrons} running
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}
            className="gap-1.5 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleTrigger("all")} disabled={!!triggeringSource}
            className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-600/20">
            {triggeringSource === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Scrape All
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTrigger("scrape-global")} disabled={!!triggeringSource}
            className="gap-1.5 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
            {triggeringSource === "scrape-global" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            Global Scrape
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard value={healthyCrons} label="Crons OK" icon={CheckCircle2} accent="emerald" />
        <KpiCard value={crons.length - healthyCrons} label="Crons Down" icon={XCircle} accent="red" />
        <KpiCard value={totalJobs.toLocaleString()} label="Active Jobs" icon={Database} accent="blue" />
        <KpiCard value={crons.length} label="Total Crons" icon={BarChart3} accent="violet" />
      </div>

      {/* System Health Overview */}
      {stats && <HealthPanel stats={stats} />}

      {/* Job Sources Grid */}
      <div>
        <SectionHeader icon={Search} label="Job Sources" count={scrapers.length} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {scrapers.map((s) => (
            <div key={s.source}
              className={`rounded-xl p-3.5 ring-1 transition-all ${
                s.isHealthy
                  ? "bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]"
                  : "bg-red-500/[0.03] ring-red-500/20 hover:ring-red-500/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white capitalize">{s.source}</h3>
                <StatusPill healthy={s.isHealthy} />
              </div>
              <div className="space-y-1.5 text-[10px] mb-3">
                <MetricRow icon={Clock} label="Last" value={s.lastRun ? timeAgo(s.lastRun) : "Never"} />
                <MetricRow icon={TrendingUp} label="New" value={String(s.jobCount)} />
                <MetricRow icon={Database} label="Total" value={s.totalJobs.toLocaleString()} bold />
              </div>
              {s.lastError && !s.isHealthy && (
                <div className="rounded-lg bg-red-500/10 p-2 text-[9px] text-red-300 truncate mb-3 ring-1 ring-red-500/20">
                  <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />{s.lastError}
                </div>
              )}
              <Button size="sm" variant="outline" disabled={!!triggeringSource} onClick={() => handleTrigger(s.source)}
                className="w-full gap-1 text-[10px] h-7 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
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
        return (
          <div key={catKey}>
            <SectionHeader icon={catConfig.icon} label={catConfig.label} count={catCrons.length} />
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

/* ── Shared Components ────────────────────────────────────────────────── */

function KpiCard({ value, label, icon: Icon, accent }: { value: string | number; label: string; icon: typeof CheckCircle2; accent: string }) {
  const styles: Record<string, { bg: string; text: string; icon: string }> = {
    emerald: { bg: "bg-emerald-500/[0.08] ring-emerald-500/20", text: "text-emerald-400", icon: "text-emerald-500" },
    red:     { bg: "bg-red-500/[0.08] ring-red-500/20", text: "text-red-400", icon: "text-red-500" },
    blue:    { bg: "bg-blue-500/[0.08] ring-blue-500/20", text: "text-blue-400", icon: "text-blue-500" },
    violet:  { bg: "bg-violet-500/[0.08] ring-violet-500/20", text: "text-violet-400", icon: "text-violet-500" },
  };
  const s = styles[accent] || styles.blue;
  return (
    <div className={`rounded-xl p-3.5 ring-1 ${s.bg}`}>
      <Icon className={`h-4 w-4 ${s.icon} mb-1.5`} />
      <div className={`text-xl font-bold tabular-nums ${s.text}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count }: { icon: typeof Globe; label: string; count: number }) {
  return (
    <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {label}
      <span className="text-slate-600">({count})</span>
    </h2>
  );
}

function StatusPill({ healthy }: { healthy: boolean }) {
  return healthy ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
      <Circle className="h-1.5 w-1.5 fill-emerald-400" /> OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400 ring-1 ring-red-500/20">
      <Circle className="h-1.5 w-1.5 fill-red-400" /> ERR
    </span>
  );
}

function MetricRow({ icon: Icon, label, value, bold }: { icon: typeof Clock; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 flex items-center gap-1">
        <Icon className="h-2.5 w-2.5" />{label}
      </span>
      <span className={`text-slate-300 tabular-nums ${bold ? "font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function CronCard({ cron: c, triggeringSource, onTrigger }: { cron: CronInfo; triggeringSource: string | null; onTrigger: (s: string) => void }) {
  const isOk = c.lastStatus === "success" || c.lastStatus === "skipped";
  const isError = c.lastStatus === "error";
  const isStale = !c.lastRun;
  const triggerId = c.key.startsWith("scrape-") && c.key !== "scrape-global"
    ? c.key.replace("scrape-", "")
    : c.key;

  const ringColor = isError
    ? "ring-red-500/20 bg-red-500/[0.03]"
    : isStale
    ? "ring-amber-500/15 bg-amber-500/[0.02]"
    : "ring-white/[0.06] bg-white/[0.02]";

  return (
    <div className={`rounded-xl p-3.5 ring-1 transition-all hover:ring-white/[0.12] ${ringColor}`}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-bold text-white">{c.label}</h3>
        <div className="flex items-center gap-1.5">
          {c.isRunning && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 ring-1 ring-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Running
            </span>
          )}
          {isOk && !c.isRunning && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
              <Circle className="h-1.5 w-1.5 fill-emerald-400" /> {c.lastStatus === "skipped" ? "Skip" : "OK"}
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400 ring-1 ring-red-500/20">
              <Circle className="h-1.5 w-1.5 fill-red-400" /> Err
            </span>
          )}
          {isStale && !c.isRunning && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[9px] font-bold text-slate-400 ring-1 ring-slate-500/20">
              <Clock className="h-2.5 w-2.5" /> Never
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-[10px] mb-2.5">
        <MetricRow icon={Clock} label="Last run" value={c.lastRun ? timeAgo(c.lastRun) : "Never"} />
        {c.lastDurationMs != null && (
          <MetricRow icon={Timer} label="Duration" value={formatDuration(c.lastDurationMs)} />
        )}
        {c.lastProcessed != null && (
          <MetricRow icon={TrendingUp} label="Processed" value={`${c.lastProcessed}${c.lastFailed ? ` (${c.lastFailed} err)` : ""}`} />
        )}
        {c.avgDurationMs != null && (
          <MetricRow icon={BarChart3} label="Avg" value={formatDuration(c.avgDurationMs)} />
        )}
        {c.recentFailures > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />Recent errors
            </span>
            <span className="text-red-300 font-bold tabular-nums">{c.recentFailures}/5</span>
          </div>
        )}
      </div>

      {c.lastMessage && (
        <div className="rounded-lg bg-white/[0.03] p-2 text-[9px] text-slate-500 truncate mb-2.5 ring-1 ring-white/[0.04]" title={c.lastMessage}>
          {c.lastMessage}
        </div>
      )}

      <Button size="sm" variant="outline" disabled={!!triggeringSource || c.isRunning} onClick={() => onTrigger(triggerId)}
        className={`w-full gap-1 text-[10px] h-7 border-white/10 ${
          isError
            ? "bg-red-500/10 text-red-300 hover:bg-red-500/20"
            : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
        }`}>
        {triggeringSource === triggerId ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
        {triggeringSource === triggerId ? "Running..." : c.isRunning ? "In Progress" : "Trigger"}
      </Button>
    </div>
  );
}

function HealthPanel({ stats }: { stats: StatsData }) {
  const { users, jobs, applicationsToday, applicationPipeline, quality, quotas, recentErrors } = stats;

  return (
    <div className="space-y-3">
      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HealthCard title="Users" icon={Users} accent="violet">
          <StatGrid>
            <StatItem label="Total" value={users.total} />
            <StatItem label="Active" value={users.active} accent="emerald" />
            <StatItem label="Paused" value={users.paused} accent="amber" />
            <StatItem label="Not onboarded" value={users.neverOnboarded} />
          </StatGrid>
        </HealthCard>

        <HealthCard title="Jobs" icon={Database} accent="blue">
          <StatGrid>
            <StatItem label="Active" value={jobs.active.toLocaleString()} accent="emerald" />
            <StatItem label="Inactive" value={jobs.inactive.toLocaleString()} />
            <StatItem label="Fresh" value={jobs.fresh} accent="blue" />
            <StatItem label="Sources" value={Object.keys(jobs.sourceDistribution).length} />
          </StatGrid>
        </HealthCard>

        <HealthCard title="Today" icon={Mail} accent="emerald">
          <StatGrid>
            <StatItem label="Sent" value={applicationsToday.sent} accent="emerald" />
            <StatItem label="Failed" value={applicationsToday.failed} accent="red" />
            <StatItem label="Bounced" value={applicationsToday.bounced} accent="amber" />
            <StatItem label="This week" value={applicationPipeline.sentThisWeek} accent="blue" />
          </StatGrid>
        </HealthCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HealthCard title="Pipeline" icon={TrendingUp} accent="cyan">
          <StatGrid>
            <StatItem label="Drafts" value={applicationPipeline.draft} />
            <StatItem label="Ready" value={applicationPipeline.ready} accent="blue" />
            <StatItem label="Sending" value={applicationPipeline.sending} accent="amber" />
            <StatItem label="Sent total" value={applicationPipeline.sentTotal} accent="emerald" />
          </StatGrid>
        </HealthCard>

        <HealthCard title="Email Quality" icon={CheckCircle2} accent="emerald">
          <StatGrid>
            <StatItem label="Delivery" value={`${quality.deliveryRate}%`} accent={quality.deliveryRate >= 90 ? "emerald" : "red"} />
            <StatItem label="Coverage" value={`${quality.overallEmailRate}%`} />
            <StatItem label="Bounced" value={quality.totalBounced} accent={quality.totalBounced > 0 ? "red" : "emerald"} />
            <StatItem label="Failed" value={quality.totalFailed} accent={quality.totalFailed > 0 ? "red" : "emerald"} />
          </StatGrid>
        </HealthCard>

        <HealthCard title="API Quotas" icon={AlertTriangle} accent="amber">
          <div className="space-y-2.5">
            {Object.entries(quotas).map(([name, q]) => {
              const pct = q.limit > 0 ? Math.round((q.used / q.limit) * 100) : 0;
              const color = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={name}>
                  <div className="flex justify-between mb-0.5 text-[10px]">
                    <span className="text-slate-400 capitalize">{name}</span>
                    <span className="text-slate-300 tabular-nums font-medium">
                      {q.used}/{q.limit > 9999 ? `${(q.limit / 1000).toFixed(1)}K` : q.limit}
                      <span className="text-slate-600 ml-1">/{q.period}</span>
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </HealthCard>
      </div>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="rounded-xl p-4 ring-1 ring-red-500/15 bg-red-500/[0.03]">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Errors (24h)</span>
            <span className="ml-auto text-[10px] text-red-400 font-bold tabular-nums">{recentErrors.length}</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {recentErrors.slice(0, 8).map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px]">
                <ChevronRight className="h-3 w-3 text-red-500/50 shrink-0 mt-0.5" />
                <span className="text-slate-600 shrink-0 tabular-nums w-14">{timeAgo(e.createdAt)}</span>
                <span className="text-amber-400 font-medium shrink-0 capitalize w-16 truncate">{e.source}</span>
                <span className="text-slate-400 truncate" title={e.message}>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthCard({ title, icon: Icon, accent, children }: { title: string; icon: typeof Users; accent: string; children: React.ReactNode }) {
  const iconColors: Record<string, string> = {
    violet: "text-violet-400", blue: "text-blue-400", emerald: "text-emerald-400",
    cyan: "text-cyan-400", amber: "text-amber-400", red: "text-red-400",
  };
  return (
    <div className="rounded-xl p-4 ring-1 ring-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-3.5 w-3.5 ${iconColors[accent] || "text-slate-400"}`} />
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>;
}

function StatItem({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400", red: "text-red-400", amber: "text-amber-400", blue: "text-blue-400",
  };
  return (
    <div>
      <div className={`text-sm font-bold tabular-nums ${colors[accent || ""] || "text-white"}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
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
