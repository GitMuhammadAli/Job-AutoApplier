"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X, RefreshCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ScraperFailure } from "@/lib/scrapers/scraper-status";
import { PIPELINE } from "@/lib/messages";

interface Props {
  failures: ScraperFailure[];
}

const STORAGE_KEY = "jobpilot-scraper-banner-dismissed";

export function ScraperStatusBanner({ failures }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Lazy hydrate from localStorage so SSR renders consistently
  if (dismissed === null && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setDismissed(stored ? JSON.parse(stored).date === todayKey() : false);
  }

  // No failures or already dismissed today.
  // The previous version also suppressed the banner when the user had ≥ 30
  // jobs from the working sources, on the theory that "if you have plenty of
  // jobs, don't bother them." That was wrong: a user with 33 jobs all from
  // rozee + jsearch is missing 4 entire sources, doesn't know which keywords
  // to broaden or which API keys to renew, and assumes the missing sources
  // simply have no matches. Always show when something is broken.
  if (failures.length === 0) return null;

  // Pipeline-dead is a different beast: the cron scheduler is down, so NO
  // fresh jobs are entering the system. This is fatal for the product's core
  // value prop — never let the user dismiss it.
  const pipelineDead = failures.find((f) => f.status === "pipeline-dead");
  if (pipelineDead) {
    return <PipelineDeadBanner failure={pipelineDead} />;
  }

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

  // Source names are infrastructure jargon to users (jsearch, arbeitnow,
  // linkedin_posts). Just tell them how many are quiet and that the
  // others are still working — they don't need to debug the pipeline.
  const summary =
    failures.length === 1
      ? PIPELINE.PARTIAL_HEADLINE_ONE
      : PIPELINE.PARTIAL_HEADLINE_MANY(failures.length);

  return (
    <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {summary}
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-amber-700/60 dark:text-amber-300/60 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/70">
            {PIPELINE.PARTIAL_BODY}
          </p>
        </div>
      </div>
    </div>
  );
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function PipelineDeadBanner({ failure }: { failure: ScraperFailure }) {
  // Calm, plain language. We never tell the user that "scraping has
  // stopped" or that "cron is misconfigured" — those are mechanism words.
  // The user only needs to know automatic refresh is paused and they can
  // tap Scan now if they want fresh results immediately.
  return (
    <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-3">
        <RefreshCcw className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {PIPELINE.DEAD_HEADLINE}
          </p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70 mt-0.5">
            {failure.reason} {PIPELINE.DEAD_BODY_CTA.replace("Scan now", "")}
            <strong>Scan now</strong> for an instant refresh.
          </p>
        </div>
      </div>
    </div>
  );
}
