"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ScraperFailure } from "@/lib/scrapers/scraper-status";

interface Props {
  failures: ScraperFailure[];
  /**
   * If the user has more than this many jobs already, the banner is hidden —
   * a couple of broken sources don't matter when the rest are doing their job.
   * Pass 0 to always show.
   */
  hideAboveJobCount?: number;
  totalJobsFound: number;
}

const STORAGE_KEY = "jobpilot-scraper-banner-dismissed";

export function ScraperStatusBanner({ failures, hideAboveJobCount = 30, totalJobsFound }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Lazy hydrate from localStorage so SSR renders consistently
  if (dismissed === null && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setDismissed(stored ? JSON.parse(stored).date === todayKey() : false);
  }

  // No failures, or user has plenty of results, or already dismissed today
  if (failures.length === 0) return null;
  if (totalJobsFound >= hideAboveJobCount) return null;
  if (dismissed === true) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: todayKey() }),
      );
    }
    setDismissed(true);
  };

  const summary =
    failures.length === 1
      ? `${failures[0].source} returned no jobs`
      : `${failures.length} job sources are returning nothing`;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              {summary}
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-amber-700/60 dark:text-amber-300/60 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
              aria-label="Dismiss until tomorrow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/70">
            That&apos;s why your list looks short. The other sources are still feeding jobs in.
          </p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide details" : "What broke?"}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1.5 text-xs">
              {failures.map((f) => (
                <li
                  key={f.source}
                  className="rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-white/60 dark:bg-zinc-900/30 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-amber-900 dark:text-amber-200 capitalize">
                      {f.source.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-amber-700/70 dark:text-amber-300/60">
                      {f.consecutiveFailures > 1
                        ? `${f.consecutiveFailures}× in a row`
                        : "last run"}
                      {" · "}
                      {formatDistanceToNow(f.lastTriedAt, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-amber-800/80 dark:text-amber-300/70 leading-relaxed">
                    {f.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
