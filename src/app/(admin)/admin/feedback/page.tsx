"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare, Bug, Lightbulb, Heart, HelpCircle,
  Clock, CheckCircle2, Eye, XCircle, Loader2, RefreshCw,
  ChevronDown, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Feedback {
  id: string;
  type: string;
  message: string;
  page: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null };
}

const TYPE_CONFIG: Record<string, { icon: typeof Bug; color: string; bg: string; label: string }> = {
  bug:        { icon: Bug, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/40", label: "Bug" },
  suggestion: { icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/40", label: "Suggestion" },
  compliment: { icon: Heart, color: "text-pink-600", bg: "bg-pink-100 dark:bg-pink-900/40", label: "Compliment" },
  other:      { icon: HelpCircle, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/40", label: "Other" },
};

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  new:      { icon: Clock, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/40", label: "New" },
  reviewed: { icon: Eye, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/40", label: "Reviewed" },
  resolved: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/40", label: "Resolved" },
  dismissed:{ icon: XCircle, color: "text-zinc-500", bg: "bg-zinc-100 dark:bg-zinc-800", label: "Dismissed" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/admin/feedback?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.feedback || []);
    } catch {
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const updateStatus = useCallback(async (id: string, status: string, adminNote?: string) => {
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Marked as ${status}`);
      fetchFeedback();
    } catch {
      toast.error("Failed to update");
    }
  }, [fetchFeedback]);

  const counts = {
    new: items.filter((i) => i.status === "new").length,
    total: items.length,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            User Feedback
            {counts.new > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {counts.new} new
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            {counts.total} total submissions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFeedback} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-1">
          {["all", "new", "reviewed", "resolved", "dismissed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {s === "all" ? "All" : (STATUS_CONFIG[s]?.label || s)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-1">
          {["all", "bug", "suggestion", "compliment", "other"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {t === "all" ? "All Types" : (TYPE_CONFIG[t]?.label || t)}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-zinc-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No feedback yet</p>
          <p className="text-sm mt-1">User feedback will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
            const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
            const TypeIcon = typeConf.icon;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-zinc-900 border rounded-xl transition-all ${
                  item.status === "new"
                    ? "border-blue-200 dark:border-blue-800/50"
                    : "border-slate-200 dark:border-zinc-700/50"
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${typeConf.bg}`}>
                    <TypeIcon className={`h-4 w-4 ${typeConf.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeConf.bg} ${typeConf.color}`}>
                        {typeConf.label}
                      </span>
                      {item.page && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{item.page}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 dark:text-zinc-200 mt-1.5 line-clamp-2">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-zinc-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.user.name || item.user.email || "Unknown"}
                      </span>
                      <span>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform shrink-0 mt-1 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-zinc-800 pt-3 ml-11">
                    <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap mb-4">
                      {item.message}
                    </p>

                    {item.adminNote && (
                      <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-3 mb-4">
                        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">Admin Note</p>
                        <p className="text-sm text-slate-700 dark:text-zinc-300">{item.adminNote}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Add a note (optional)..."
                        value={noteInputs[item.id] || ""}
                        onChange={(e) => setNoteInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {item.status !== "reviewed" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "reviewed", noteInputs[item.id])}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Reviewed
                          </Button>
                        )}
                        {item.status !== "resolved" && (
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => updateStatus(item.id, "resolved", noteInputs[item.id])}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolved
                          </Button>
                        )}
                        {item.status !== "dismissed" && (
                          <Button size="sm" variant="outline" className="text-zinc-500 border-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800" onClick={() => updateStatus(item.id, "dismissed", noteInputs[item.id])}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
