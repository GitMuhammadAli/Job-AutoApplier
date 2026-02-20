"use client";

import Link from "next/link";

export default function ApplicationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3">
        <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-800 dark:text-zinc-100">
        Failed to load applications
      </h2>
      <p className="text-sm text-slate-500 dark:text-zinc-400 text-center max-w-sm">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 dark:text-zinc-500">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          Try Again
        </button>
        <Link href="/dashboard" className="rounded-lg border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
