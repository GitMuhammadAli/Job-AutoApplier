"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Zap, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScraperInfo {
  source: string;
  lastRun: string | null;
  lastMessage: string | null;
  jobCount: number;
  isHealthy: boolean;
  lastError: string | null;
}

export default function AdminScrapersPage() {
  const [scrapers, setScrapers] = useState<ScraperInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);

  useEffect(() => {
    fetchScrapers();
  }, []);

  async function fetchScrapers() {
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
  }

  async function handleTrigger(source: string) {
    setTriggeringSource(source);
    try {
      const res = await fetch("/api/admin/scrapers/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (res.ok) {
        toast.success(`Triggered ${source}`);
        setTimeout(fetchScrapers, 3000);
      } else {
        toast.error("Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger");
    }
    setTriggeringSource(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Scrapers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {scrapers.filter((s) => s.isHealthy).length}/{scrapers.length} healthy
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchScrapers}
            className="gap-1.5"
          >
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
            Trigger All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scrapers.map((s) => (
          <div
            key={s.source}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 capitalize">
                {s.source}
              </h3>
              {s.isHealthy ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Last run</span>
                <span className="text-slate-700 font-medium">
                  {s.lastRun
                    ? new Date(s.lastRun).toLocaleString()
                    : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jobs found (last)</span>
                <span className="text-slate-700 font-medium tabular-nums">
                  {s.jobCount}
                </span>
              </div>
            </div>

            {s.lastMessage && (
              <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500 truncate">
                {s.lastMessage}
              </div>
            )}

            {s.lastError && (
              <div className="mt-2 rounded-lg bg-red-50 p-2 text-[10px] text-red-600 truncate">
                {s.lastError}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full mt-3 gap-1.5 text-xs"
              disabled={!!triggeringSource}
              onClick={() => handleTrigger(s.source)}
            >
              {triggeringSource === s.source ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Trigger
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
