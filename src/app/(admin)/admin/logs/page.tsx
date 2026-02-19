"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  type: string;
  source: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const LOG_TYPES = ["", "scrape", "error", "apply", "send", "api_usage", "api_call", "bounce", "notification", "follow-up"];
const LOG_SOURCES = ["", "indeed", "remotive", "arbeitnow", "linkedin", "rozee", "jsearch", "adzuna", "google", "groq", "system"];

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, source, page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (source) params.set("source", source);
      params.set("page", String(page));
      params.set("limit", "50");
      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs || data);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || (data.logs || data).length);
    } catch {
      toast.error("Failed to load logs");
    }
    setLoading(false);
  }

  const typeBadgeColor: Record<string, string> = {
    scrape: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    error: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    apply: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
    send: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    bounce: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    notification: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
    "follow-up": "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">System Logs</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">{total} total entries</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchLogs} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Type:</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="h-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All</option>
            {LOG_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Source:</label>
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="h-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All</option>
            {LOG_SOURCES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-8 text-center ring-1 ring-slate-100 dark:ring-zinc-700">
          <p className="text-sm text-slate-400 dark:text-zinc-500">No logs found</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-700 text-slate-500 dark:text-zinc-400">
                <th className="py-2.5 px-4 text-left font-semibold w-40">Time</th>
                <th className="py-2.5 px-4 text-left font-semibold w-24">Type</th>
                <th className="py-2.5 px-4 text-left font-semibold w-24">Source</th>
                <th className="py-2.5 px-4 text-left font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-slate-50 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-700/50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="py-2.5 px-4 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        typeBadgeColor[log.type] || "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {log.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-zinc-300 capitalize">{log.source || "-"}</td>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-zinc-200">
                    <div className="truncate max-w-md">{log.message}</div>
                    {expandedId === log.id && log.metadata && (
                      <pre className="mt-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 p-2 text-[10px] text-slate-500 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
