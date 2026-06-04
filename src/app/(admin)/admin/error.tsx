"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
      <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
        <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 dark:text-zinc-100">
        Admin panel hit a snag
      </h2>
      <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">
        {error.message && !error.message.includes("Error:")
          ? error.message
          : "Something went sideways in the admin panel. Try again."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
          ref: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Admin home
        </Link>
      </div>
    </div>
  );
}
