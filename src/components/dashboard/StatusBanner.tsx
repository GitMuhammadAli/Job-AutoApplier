"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  RefreshCw,
  Search,
  Sparkles,
  AlertTriangle,
  Loader2,
  Radio,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StatusData {
  lastScrapeAt: string | null;
  scrapeRunning: boolean;
  newJobsCount: number;
  totalJobs: number;
  warnings: string[];
  nextScrapeIn: number;
  recentAutoApply: Record<string, unknown> | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StatusBanner() {
  const { data, error } = useSWR<StatusData>("/api/status", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  const [scanning, setScanning] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(0);

  useEffect(() => {
    if (scanCooldown <= 0) return;
    const timer = setInterval(() => {
      setScanCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [scanCooldown]);

  const handleScanNow = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/jobs/scan-now", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        toast.success(
          result.newJobs > 0
            ? `Found ${result.newJobs} new jobs!`
            : "Scan complete. No new jobs found."
        );
        setScanCooldown(300);
      } else {
        toast.error(result.error || "Scan failed.");
      }
    } catch {
      toast.error("Scan request failed.");
    }
    setScanning(false);
  }, []);

  if (error || !data) {
    return null;
  }

  const hasWarnings = data.warnings && data.warnings.length > 0;

  if (data.scrapeRunning) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-blue-50 px-4 py-2.5 ring-1 ring-blue-200/60">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-xs font-semibold text-blue-700">
          Fetching new jobs&hellip;
        </span>
      </div>
    );
  }

  if (data.newJobsCount > 0) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-violet-50 px-4 py-2.5 ring-1 ring-violet-200/60">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="text-xs font-semibold text-violet-700">
            {data.newJobsCount} new job{data.newJobsCount !== 1 ? "s" : ""}{" "}
            matched since your last visit!
          </span>
        </div>
      </div>
    );
  }

  if (data.recentAutoApply) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-200/60">
        <Zap className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700">
          Auto-apply ran recently. Check your Application Queue.
        </span>
      </div>
    );
  }

  if (hasWarnings) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-200/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 truncate">
            {data.warnings[0]}
          </span>
        </div>
      </div>
    );
  }

  const timeAgo = data.lastScrapeAt
    ? formatTimeAgo(data.lastScrapeAt)
    : "Never";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200/60">
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Radio className="h-3 w-3" />
          Last scan: {timeAgo}
        </span>
        <span className="tabular-nums">{data.totalJobs} jobs tracked</span>
        <span className="tabular-nums">
          Next refresh: {data.nextScrapeIn}m
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1.5 touch-manipulation"
        onClick={handleScanNow}
        disabled={scanning || scanCooldown > 0}
      >
        {scanning ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Search className="h-3 w-3" />
        )}
        {scanCooldown > 0
          ? `Scan (${Math.floor(scanCooldown / 60)}:${String(scanCooldown % 60).padStart(2, "0")})`
          : "Scan Now"}
      </Button>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
