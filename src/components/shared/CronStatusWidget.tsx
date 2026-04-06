"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  RefreshCw,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CronRow {
  key: string;
  label: string;
  category: string;
  schedule: string;
  scheduleLabel: string;
  lastRunAt: string | null;
  lastStatus: "success" | "error" | "skipped" | null;
  lastDurationMs: number | null;
  lastProcessed: number | null;
  lastFailed: number | null;
  nextRunAt: string;
  intervalMs: number;
  triggerable: boolean;
}

interface CronStatusResponse {
  crons: CronRow[];
  isAdmin: boolean;
  generatedAt: string;
}

type Health = "ok" | "warn" | "err" | "unknown";

const CATEGORY_LABEL: Record<string, string> = {
  scraper: "Scrapers",
  matching: "Matching",
  application: "Applications",
  notification: "Notifications",
  followup: "Follow-ups",
  maintenance: "Maintenance",
};

const CATEGORY_ORDER = [
  "scraper",
  "matching",
  "application",
  "notification",
  "followup",
  "maintenance",
];

function classifyHealth(row: CronRow, nowMs: number): Health {
  if (!row.lastRunAt) return "unknown";
  if (row.lastStatus === "error") return "err";
  const lastMs = new Date(row.lastRunAt).getTime();
  const age = nowMs - lastMs;
  if (age <= row.intervalMs * 1.2) return "ok";
  if (age <= row.intervalMs * 2) return "warn";
  return "err";
}

function overallHealth(rows: CronRow[], nowMs: number): Health {
  if (rows.length === 0) return "unknown";
  let hasErr = false;
  let hasWarn = false;
  for (const r of rows) {
    const h = classifyHealth(r, nowMs);
    if (h === "err") hasErr = true;
    else if (h === "warn") hasWarn = true;
  }
  if (hasErr) return "err";
  if (hasWarn) return "warn";
  return "ok";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "due";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  if (days >= 1) {
    const hours = Math.floor((totalSec % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
  const hours = Math.floor(totalSec / 3600);
  if (hours >= 1) {
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 1) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  return `${secs}s`;
}

function formatRelative(isoStr: string | null, nowMs: number): string {
  if (!isoStr) return "never";
  const diff = nowMs - new Date(isoStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function CronStatusWidget() {
  const [data, setData] = useState<CronStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron-status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CronStatusResponse;
      if (mountedRef.current) setData(json);
    } catch (err) {
      console.warn("[CronStatusWidget] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Mount + unmount guard
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial load + 30s polling that pauses when tab is hidden
  useEffect(() => {
    fetchData();

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchData();
        }
      }, 30_000);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  // 1-second tick for countdowns
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const crons = data?.crons ?? [];
  const health = useMemo(() => overallHealth(crons, now), [crons, now]);

  const nextUp = useMemo(() => {
    if (crons.length === 0) return null;
    let soonest: CronRow | null = null;
    let soonestMs = Infinity;
    for (const r of crons) {
      const diff = new Date(r.nextRunAt).getTime() - now;
      if (diff >= 0 && diff < soonestMs) {
        soonestMs = diff;
        soonest = r;
      }
    }
    return soonest ? { row: soonest, ms: soonestMs } : null;
  }, [crons, now]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, CronRow[]> = {};
    for (const r of crons) {
      const cat = r.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    }
    return groups;
  }, [crons]);

  async function handleTrigger(cronKey: string) {
    setTriggering(cronKey);
    try {
      const res = await fetch("/api/admin/scrapers/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: cronKey }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error || `Failed to trigger ${cronKey}`);
      } else {
        toast.success(`Triggered ${cronKey}`);
        // Refetch after a short delay so the new run shows up
        setTimeout(fetchData, 3000);
      }
    } catch {
      toast.error("Trigger request failed");
    } finally {
      if (mountedRef.current) setTriggering(null);
    }
  }

  const dotColor =
    health === "ok"
      ? "bg-emerald-500"
      : health === "warn"
      ? "bg-amber-500"
      : health === "err"
      ? "bg-red-500"
      : "bg-slate-400";

  const ringColor =
    health === "ok"
      ? "ring-emerald-500/20"
      : health === "warn"
      ? "ring-amber-500/30"
      : health === "err"
      ? "ring-red-500/30"
      : "ring-slate-300 dark:ring-zinc-700";

  const countdownText = nextUp
    ? `Next: ${formatCountdown(nextUp.ms)}`
    : "Idle";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Cron status"
          className={cn(
            "hidden sm:inline-flex items-center gap-1.5 h-8 md:h-9 px-2.5 rounded-lg text-[11px] font-medium transition-colors",
            "bg-slate-50/80 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300",
            "hover:bg-slate-100 dark:hover:bg-zinc-800",
            "border border-slate-200/60 dark:border-zinc-700/60",
            "ring-1 ring-inset",
            ringColor,
          )}
        >
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              dotColor,
              loading && "animate-pulse",
            )}
          />
          <span className="tabular-nums">{countdownText}</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : (
            <RefreshCw className="h-3 w-3 text-slate-400" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-h-[70vh] overflow-y-auto p-0 border-slate-200/60 dark:border-zinc-700/60 bg-white dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              Cron Status
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1",
                health === "ok" &&
                  "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
                health === "warn" &&
                  "bg-amber-500/10 text-amber-500 ring-amber-500/20",
                health === "err" &&
                  "bg-red-500/10 text-red-500 ring-red-500/20",
                health === "unknown" &&
                  "bg-slate-500/10 text-slate-500 ring-slate-500/20",
              )}
            >
              <Circle className={cn("h-1.5 w-1.5 fill-current")} />
              {health === "ok"
                ? "All OK"
                : health === "warn"
                ? "Degraded"
                : health === "err"
                ? "Issues"
                : "No data"}
            </span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh cron status"
            className="h-6 w-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-2 space-y-3">
          {crons.length === 0 && !loading && (
            <div className="py-6 text-center text-xs text-slate-500">
              No cron data available.
            </div>
          )}

          {CATEGORY_ORDER.map((catKey) => {
            const rows = groupedByCategory[catKey];
            if (!rows || rows.length === 0) return null;
            return (
              <div key={catKey}>
                <div className="px-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                  {CATEGORY_LABEL[catKey] ?? catKey}
                </div>
                <div className="space-y-1">
                  {rows.map((row) => (
                    <CronRowItem
                      key={row.key}
                      row={row}
                      nowMs={now}
                      isAdmin={data?.isAdmin ?? false}
                      triggering={triggering}
                      onTrigger={handleTrigger}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CronRowItemProps {
  row: CronRow;
  nowMs: number;
  isAdmin: boolean;
  triggering: string | null;
  onTrigger: (cronKey: string) => void;
}

function CronRowItem({
  row,
  nowMs,
  isAdmin,
  triggering,
  onTrigger,
}: CronRowItemProps) {
  const health = classifyHealth(row, nowMs);
  const nextDiff = new Date(row.nextRunAt).getTime() - nowMs;
  const duration = formatDuration(row.lastDurationMs);

  const statusIcon =
    health === "ok" ? (
      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
    ) : health === "warn" ? (
      <AlertTriangle className="h-3 w-3 text-amber-500" />
    ) : health === "err" ? (
      <XCircle className="h-3 w-3 text-red-500" />
    ) : (
      <Circle className="h-3 w-3 text-slate-400" />
    );

  const canTrigger = isAdmin && row.triggerable;

  return (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 ring-1 ring-inset transition-colors",
        "bg-slate-50/50 dark:bg-zinc-800/50",
        health === "err"
          ? "ring-red-500/20"
          : health === "warn"
          ? "ring-amber-500/20"
          : "ring-slate-200/60 dark:ring-zinc-700/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {statusIcon}
          <span
            className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 truncate"
            title={row.label}
          >
            {row.label}
          </span>
        </div>
        {canTrigger && (
          <Button
            size="sm"
            variant="outline"
            disabled={triggering !== null}
            onClick={() => onTrigger(row.key)}
            className="h-5 px-1.5 text-[9px] gap-1"
          >
            {triggering === row.key ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Zap className="h-2.5 w-2.5" />
            )}
            Run
          </Button>
        )}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-1 truncate" title={row.scheduleLabel}>
          <Timer className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{row.scheduleLabel}</span>
        </div>
        <div className="flex items-center gap-1 justify-end tabular-nums">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {nextDiff <= 0 ? "due" : formatCountdown(nextDiff)}
        </div>
        <div className="truncate">
          last: {formatRelative(row.lastRunAt, nowMs)}
        </div>
        {duration && (
          <div className="text-right tabular-nums">{duration}</div>
        )}
      </div>
    </div>
  );
}
