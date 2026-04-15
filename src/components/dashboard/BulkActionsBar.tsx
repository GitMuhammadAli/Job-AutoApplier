"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bulkDeleteOldJobs, bulkDismissByStage } from "@/app/actions/job";
import { bulkDeleteByStatus, bulkCancelDrafts, startFresh } from "@/app/actions/application";
import {
  Trash2,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronDown,
  FileX,
  RotateCcw,
} from "lucide-react";
import { DASHBOARD, GENERIC } from "@/lib/messages";

export function BulkActionsBar({ jobCount }: { jobCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (jobCount < 5) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Trash2 className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
          Bulk Actions
        </span>
        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
          {jobCount} jobs in pipeline
        </span>
        <ChevronDown className={`h-3.5 w-3.5 ml-auto text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Clear old saved jobs */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-full sm:w-auto sm:min-w-[100px]">
              <Clock className="h-3 w-3 inline mr-1" />Clear old saved:
            </span>
            {[3, 7, 14, 30].map((days) => (
              <Button
                key={days}
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                disabled={isPending}
                onClick={() => setShowConfirm(`old-${days}`)}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {`> ${days} days`}
              </Button>
            ))}
          </div>

          {/* Clear by stage */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-full sm:w-auto sm:min-w-[100px]">
              <Trash2 className="h-3 w-3 inline mr-1" />Clear stage:
            </span>
            {[
              { stage: "SAVED", label: "Saved" },
              { stage: "REJECTED", label: "Rejected" },
              { stage: "GHOSTED", label: "Ghosted" },
            ].map(({ stage, label }) => (
              <Button
                key={stage}
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                disabled={isPending}
                onClick={() => setShowConfirm(`stage-${stage}`)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Application bulk actions */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-full sm:w-auto sm:min-w-[100px]">
              <FileX className="h-3 w-3 inline mr-1" />Applications:
            </span>
            {(["FAILED", "BOUNCED", "CANCELLED"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                disabled={isPending}
                onClick={() => setShowConfirm(`app-${status}`)}
              >
                Delete {status.charAt(0) + status.slice(1).toLowerCase()}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] gap-1"
              disabled={isPending}
              onClick={() => setShowConfirm("cancel-drafts")}
            >
              Cancel All Drafts
            </Button>
          </div>

          {/* Start Fresh */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-full sm:w-auto sm:min-w-[100px]">
              <RotateCcw className="h-3 w-3 inline mr-1" />Nuclear:
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              disabled={isPending}
              onClick={() => setShowConfirm("start-fresh")}
            >
              <AlertTriangle className="h-3 w-3" />
              Start Fresh
            </Button>
          </div>

          {/* Confirmation dialog */}
          {showConfirm && (
            <div className={`rounded-lg p-3 ring-1 flex items-start gap-2 ${
              showConfirm === "start-fresh"
                ? "bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800/40"
                : "bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800/40"
            }`}>
              <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${showConfirm === "start-fresh" ? "text-red-500" : "text-amber-500"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${showConfirm === "start-fresh" ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"}`}>
                  {showConfirm.startsWith("old-") && `Clear all saved jobs older than ${showConfirm.split("-")[1]} days?`}
                  {showConfirm.startsWith("stage-") && `Clear all "${showConfirm.split("-")[1]}" jobs?`}
                  {showConfirm.startsWith("app-") && `Delete all ${showConfirm.split("-")[1].toLowerCase()} applications?`}
                  {showConfirm === "cancel-drafts" && "Cancel all draft applications?"}
                  {showConfirm === "start-fresh" && "Remove ALL jobs and applications? This cannot be undone."}
                </p>
                <p className={`text-[10px] mt-0.5 ${showConfirm === "start-fresh" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {showConfirm === "start-fresh"
                    ? `This will remove all ${jobCount} jobs and their applications permanently.`
                    : "This action cannot be easily undone."}
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    className={`h-6 text-[10px] ${showConfirm === "start-fresh" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
                    disabled={isPending}
                    onClick={() => {
                      setShowConfirm(null);
                      startTransition(async () => {
                        let result;
                        if (showConfirm.startsWith("old-")) {
                          result = await bulkDeleteOldJobs(parseInt(showConfirm.split("-")[1]));
                          if (result.success) toast.success(DASHBOARD.CLEARED_OLD_JOBS(result.count));
                        } else if (showConfirm.startsWith("stage-")) {
                          const stage = showConfirm.split("-")[1];
                          result = await bulkDismissByStage(stage);
                          if (result.success) toast.success(DASHBOARD.CLEARED_JOBS(result.count));
                        } else if (showConfirm.startsWith("app-")) {
                          const status = showConfirm.split("-")[1] as "FAILED" | "BOUNCED" | "CANCELLED";
                          result = await bulkDeleteByStatus(status);
                          if (result.success) toast.success(DASHBOARD.DELETED_APPS_STATUS(result.count, status.toLowerCase()));
                        } else if (showConfirm === "cancel-drafts") {
                          result = await bulkCancelDrafts();
                          if (result.success) toast.success(DASHBOARD.CANCELLED_DRAFTS(result.count));
                        } else if (showConfirm === "start-fresh") {
                          result = await startFresh();
                          if (result.success) toast.success(DASHBOARD.ALL_DATA_CLEARED);
                        }
                        if (result && !result.success) toast.error("error" in result ? result.error : GENERIC.FAILED_GENERIC);
                        router.refresh();
                      });
                    }}
                  >
                    {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    {showConfirm === "start-fresh" ? "Yes, Start Fresh" : "Confirm"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => setShowConfirm(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
