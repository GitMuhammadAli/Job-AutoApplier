"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  type: string;
  source: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const LOG_TYPES = [
  { value: "all", label: "All Types" },
  { value: "scrape", label: "Scrape" },
  { value: "apply", label: "Apply" },
  { value: "error", label: "Error" },
  { value: "notification", label: "Notification" },
  { value: "email", label: "Email" },
  { value: "match", label: "Match" },
];

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;
    try {
      const params = new URLSearchParams({
        skip: String(currentPage * 50),
        take: "50",
      });
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) throw new Error();
      const data: LogEntry[] = await res.json();
      if (reset) {
        setLogs(data);
        setPage(0);
      } else {
        setLogs((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === 50);
    } catch {
      toast.error("Failed to load logs");
    }
    setLoading(false);
  }, [typeFilter, page]);

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const typeColor = (type: string): string => {
    switch (type) {
      case "error": return "bg-red-100 text-red-700";
      case "scrape": return "bg-blue-100 text-blue-700";
      case "apply": return "bg-violet-100 text-violet-700";
      case "notification": return "bg-emerald-100 text-emerald-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">System Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Recent system events</p>
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => fetchLogs(true)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-100/80 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-3 px-4 text-left font-semibold">Time</th>
              <th className="py-3 px-4 text-left font-semibold">Type</th>
              <th className="py-3 px-4 text-left font-semibold">Source</th>
              <th className="py-3 px-4 text-left font-semibold">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeColor(log.type)}`}>
                    {log.type}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-slate-500">{log.source || "—"}</td>
                <td className="py-2.5 px-4 text-slate-700 max-w-md truncate">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPage((p) => p + 1);
              fetchLogs();
            }}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
