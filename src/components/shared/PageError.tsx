"use client";

/**
 * Shared error UI for App Router error.tsx boundaries.
 *
 * Was: 7 identical error.tsx files across /settings, /resumes, /applications,
 * /jobs/[id], /jobs/new, /templates, /system-health, /analytics, each with
 * its own "Failed to load X" copy + "Try Again" / "Go to Dashboard" buttons.
 * Stale FAANG-style copy was the same on every page; updating it meant
 * editing 7 files. Now: one component, one source of truth for copy.
 *
 * Each error.tsx becomes a 3-line wrapper:
 *   export default function (props) => <PageError resource="settings" {...props} />
 */
import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface PageErrorProps {
  /**
   * Friendly noun for what failed to load — used in the headline. Examples:
   * "settings", "your resumes", "applications", "this job", "templates".
   * Falls into a sentence: "We couldn't load X right now."
   */
  resource: string;
  error: Error & { digest?: string };
  reset: () => void;
}

export function PageError({ resource, error, reset }: PageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
      <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
        <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 dark:text-zinc-100">
        We couldn&apos;t load {resource}
      </h2>
      <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">
        {error.message && !error.message.includes("Error:")
          ? error.message
          : "Something went sideways. Try again — if it keeps happening, refresh the page."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
          ref: {error.digest}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
